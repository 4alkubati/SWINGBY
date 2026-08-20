"""
area.py — the coarse location a job post shows before anyone is booked.

WHY THIS EXISTS
---------------
A business scrolling the feed has to decide whether a job is worth quoting, and
the first question is always "where is it". The full street address is not the
answer: nobody is booked yet, and publishing a client's door number to every
business in the category is a privacy problem the moment the app has real users.

Calgary answers this with quadrants. "SW" tells a tradesperson in Bowness that
the job is a 30-minute drive; "NW" tells them it is ten minutes. That is the
whole decision, and it needs no street.

WHY THE ADDRESS TEXT, AND NOT THE COORDINATES
---------------------------------------------
Every post carries lat/lng, so computing the quadrant from a Centre Street /
Centre Avenue cross is the obvious implementation. It is also wrong often
enough to be dangerous. Checked against 12 live posts whose address already
states a quadrant, the coordinate cross disagreed with the stated value twice:

    200 Barclay Parade SW  -> computed NW, stated SW   (Eau Claire)
    823 Radford Rd NE      -> computed SE, stated NE

Calgary's quadrant boundaries are not a straight cross. The N/S divide follows
the Bow River through the core rather than a line of latitude, and the downtown
blocks are designated by convention. A 2-in-12 error rate is not a rounding
problem: it sends a tradesperson to the wrong side of the city, and they will
not trust the field again.

So this reads what the address SAYS, and returns None when the address does not
say. Showing nothing is honest; showing the wrong quadrant is worse than
showing nothing.

COVERAGE, measured against the 75 live posts that have an address:
    70  state a quadrant (64 abbreviated "SW", 6 spelled "Southwest")
     5  do not — "Calgary, AB", a typo'd street, and one job in Orillia, Ontario
"""

from __future__ import annotations

import re
from typing import Optional

QUADRANTS = ("NW", "NE", "SW", "SE")

# Two spellings reach us. A client typing an address by hand writes "SW"; the
# Google geocoder rewrites the same address as "Southwest". Both appear in live
# data, and an earlier count that matched only the abbreviation under-reported
# coverage by six posts.
_ABBREV = re.compile(r"(?<![A-Za-z])(NW|NE|SW|SE)(?![A-Za-z])", re.IGNORECASE)
_SPELLED = re.compile(
    r"(?<![A-Za-z])(north\s*west|north\s*east|south\s*west|south\s*east)(?![A-Za-z])",
    re.IGNORECASE,
)

_SPELLED_TO_ABBREV = {
    "northwest": "NW",
    "northeast": "NE",
    "southwest": "SW",
    "southeast": "SE",
}


def quadrant_for(address: Optional[str]) -> Optional[str]:
    """The Calgary quadrant an address states, or None if it states none.

    Deliberately conservative:

    * a bare "West" or "East" is NOT a quadrant. "143 Fittons Road West" is a
      real address in the live data — in Orillia, Ontario — and reading it as a
      Calgary quadrant would place a job 3,000 km from where it is.
    * the LAST match wins. Street names contain these letters ("Nesbitt",
      "Sweetgrass"), and the quadrant in Canadian addressing comes after the
      street type, so the trailing match is the designation rather than a
      fragment of a name.
    """
    if not address:
        return None

    spelled = _SPELLED.findall(address)
    if spelled:
        key = re.sub(r"\s+", "", spelled[-1]).lower()
        return _SPELLED_TO_ABBREV.get(key)

    abbrev = _ABBREV.findall(address)
    if abbrev:
        return abbrev[-1].upper()

    return None


def area_label(address: Optional[str]) -> Optional[str]:
    """What the client-facing field shows. None means "say nothing"."""
    return quadrant_for(address)
