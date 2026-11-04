---
title: Treningsøkter
---

# Treningsøkter for G2017

Her samler vi treningsøkter og lenker til øvelser.

{% assign okter = site.pages | where_exp: "page", "page.path contains 'okter/'" | sort: "path" | reverse %}
{% if okter.size == 0 %}
Ingen økter er publisert ennå.
{% else %}
{% for okt in okter %}
- [{{ okt.title | escape }}]({{ okt.url | relative_url }})
{% endfor %}
{% endif %}
