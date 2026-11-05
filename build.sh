#!/bin/sh
# Builds two copies of Paper Trail from src/:
#   index.html     standalone page (open it directly, or host it on GitHub Pages)
#   artifact.html  body-only copy for publishing as a claude.ai artifact
set -e
cd "$(dirname "$0")"
JS="src/03-engine.js src/04-app-core.js src/05-review.js src/06-export.js src/07-init.js"

{
  cat src/01-head.html src/02-body.html
  echo '<script>'
  cat $JS
  echo '</script>'
} > artifact.html

{
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  cat src/01-head.html
  echo '</head>'
  echo '<body>'
  cat src/02-body.html
  echo '<script>'
  cat $JS
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > index.html

echo "Built index.html ($(wc -c < index.html | tr -d ' ') bytes) and artifact.html"
