# SwingBy — repo chores.
#
# Setup, once:
#   echo ".status/" >> .gitignore                  (already done)
#   pip install "psycopg[binary]"                  (optional — live prod counts)
#   export DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres"
#
# Without DATABASE_URL the production section prints its SQL on the page for
# pasting into the Supabase editor. Either way you see the queries.
#
# Trunk defaults to `main`; override with STATUS_TRUNK=<branch>.

.PHONY: status status-open status-git

## status — regenerate the truth about this repo, then open it
status:
	@python3 tools/status.py --open

## status-git — git facts only, skip the database
status-git:
	@python3 tools/status.py --no-db

## status-open — regenerate without launching a browser
status-open:
	@python3 tools/status.py
