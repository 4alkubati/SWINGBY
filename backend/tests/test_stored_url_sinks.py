"""
test_stored_url_sinks.py — SB-0015 / SB-0016: every stored image URL goes
through the same validator, not just the one the pentest happened to name.

Pentest M-04 was filed against `users.avatar_url`, and the D7.8 fix
(`url_safety.validate_public_https_url`) was applied there and nowhere else.
Two sibling sinks write the same class of value and never got it:

  * `businesses.logo_url` checked only that the string started with http:// or
    https://, while its own docstring claimed "Same contract as
    users.avatar_url" — which stopped being true the moment the M-04 fix
    landed on one of the three. It accepted http://169.254.169.254/,
    http://127.0.0.1:22/x, http://localhost/ and http://metadata.google.internal/.
  * `employees.avatar_url` had no validator at all — strictly weaker than the
    PRE-fix state of users.avatar_url, which at least reached a scheme check.
    It accepted javascript: and file:/// too.

Both are rendered to other users (a business logo on every search result, an
employee avatar on the team card), and both are one feature away — avatar
thumbnailing, a link preview, an email embed — from becoming live SSRF.

This file is parametrized across all three sinks on purpose. The failure mode
being tested for is not "this one URL is accepted"; it is "the fix reached one
sink and the reviewer believed it reached the class".
"""

import pytest
from pydantic import ValidationError

# The six payloads url_safety's own docstring names as the finding, plus the
# two schemes employees.avatar_url uniquely allowed.
UNSAFE_URLS = [
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://127.0.0.1:22/x",
    "http://localhost/",
    "http://[::1]/",
    "http://10.0.0.5/internal",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "gopher://127.0.0.1:6379/_SET%20foo%20bar",
]

SAFE_URL = (
    "https://ulnxapnsenzyddddldjt.supabase.co/storage/v1/object/public/job-photos/x.jpg"
)


def _build_business(logo_url):
    from app.api.businesses import _validate_logo_url

    return _validate_logo_url(logo_url)


def _build_employee(avatar_url):
    from app.api.employees import EmployeeCreate

    return EmployeeCreate(
        email="e@example.com",
        password="Passw0rdish",
        first_name="A",
        last_name="B",
        avatar_url=avatar_url,
    ).avatar_url


def _build_user(avatar_url):
    from app.api import auth

    model = getattr(auth, "ProfileUpdate", None)
    if model is None:  # pragma: no cover - name drift guard
        pytest.skip("profile model not found under the expected name")
    return model(avatar_url=avatar_url).avatar_url


SINKS = [
    pytest.param(_build_business, id="businesses.logo_url"),
    pytest.param(_build_employee, id="employees.avatar_url"),
    pytest.param(_build_user, id="users.avatar_url"),
]


@pytest.mark.parametrize("build", SINKS)
@pytest.mark.parametrize("url", UNSAFE_URLS)
def test_every_sink_refuses_internal_and_non_https_urls(build, url):
    with pytest.raises((ValueError, ValidationError)):
        build(url)


@pytest.mark.parametrize("build", SINKS)
def test_every_sink_still_accepts_a_real_upload_url(build):
    assert build(SAFE_URL) == SAFE_URL


@pytest.mark.parametrize("build", SINKS)
@pytest.mark.parametrize("blank", [None, "", "   "])
def test_clearing_the_image_stays_expressible(build, blank):
    """Removing a logo/avatar is legitimate and must not become an error."""
    assert build(blank) is None


def test_validator_is_shared_rather_than_reimplemented():
    """
    The regression this guards: three copies of "is this URL safe" drifting
    apart again. Each sink must call the one validator.
    """
    import inspect

    from app.api import businesses, employees

    for module in (businesses, employees):
        src = inspect.getsource(module)
        assert "url_safety" in src, (
            f"{module.__name__} must route its stored URL through "
            "app.services.url_safety, not its own scheme check"
        )
