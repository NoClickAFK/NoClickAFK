# Report v4.3.3 Visual Specification

## Design direction

The exported report follows **Boardroom Executive Report + Luxury Editorial Dossier**.

The visual objective is a calm, decision-ready document for an owner, executive or investor. It must read as a report, not as an application screen, dashboard, CRM record or accounting form.

Principles:

- one clear executive narrative;
- deliberate hierarchy instead of decorative density;
- restrained deep green and brass accents;
- whitespace before borders;
- no more than two visible surface levels;
- one prominent management decision;
- analytical recommendation and management decision remain separate concepts.

This specification applies only to exported HTML/PDF reports.

## Typography tokens

Body and data use the system sans-serif stack:

`Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`

Editorial display and selected section headings use:

`Georgia, "Times New Roman", serif`

Desktop scale:

| Token | Size | Weight | Use |
|---|---:|---:|---|
| Display title | 46 px | 700 | report hero title |
| Report section H2 | 28 px | 700 | executive sections |
| Dossier H3 | 21 px | 700 | report subsections |
| Body | 15.5 px | 400-520 | narrative and data |
| Secondary body | 14 px | 400-520 | supporting context |
| Caption / metadata | 12.5-13 px | 600-700 | short metadata only |
| KPI | 30-36 px | 700-760 | authoritative metrics |
| Status | 12.5 px | 700 | recommendation/status pills |

Rules:

- important body text is never below 13 px;
- uppercase is restricted to short metadata labels;
- narrative copy uses a maximum readable line length of approximately 74 characters;
- not every value is bold;
- serif is used selectively for editorial hierarchy, not for all content.

## Spacing tokens

| Token | Desktop | Mobile |
|---|---:|---:|
| Page gutter | 44 px | 18 px |
| Major section gap | 46 px | 36 px |
| Regular block gap | 26 px | 22 px |
| Inner content gap | 18 px | 16 px |
| Row gap | 12 px | 10 px |
| Compact gap | 8 px | 8 px |

Rules:

- hero, executive summary, analytical sections and dossiers share the same left edge;
- major top-level sections never touch;
- open accordion content has meaningful bottom padding;
- arbitrary one-off margins are avoided.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| Deep green | `#143f30` | primary executive accent |
| Secondary green | `#1e5943` | gradient and emphasis |
| Green soft | `#e8f0eb` | analytical recommendation |
| Ink | `#17231d` | primary text |
| Muted | `#637169` | secondary text |
| Line | `#dce2dd` | logical separators |
| Paper | `#fffefa` | report surfaces |
| Canvas | `#f2efe8` | neutral page background |
| Brass | `#a88045` | selected rank, conclusion and premium metadata |
| Brass soft | `#f1e8d8` | restrained rank background |
| Risk | `#7b3030` | accessible risk text |
| Risk soft | `#f5e7e4` | risk background |

Brass is not a general decorative colour. It is limited to rank, executive conclusion, premium metadata and selected separators.

## Radius and shadow rules

- top-level hero radius: 24 px;
- top-level dossier radius: 20 px;
- internal emphasis radius: 12-14 px;
- ordinary rows: 0 px radius;
- one subtle shadow per top-level report/dossier surface;
- internal sections and rows have no shadow;
- whitespace is preferred over borders;
- thin borders are used only between logical groups.

Nested visual depth must not exceed two surfaces.

## Component hierarchy

1. Report hero.
2. Executive or portfolio summary.
3. Priority/risk analytical sections.
4. Secondary comparison tool.
5. Detailed location dossiers.
6. Editorial section rows and definition lists.

Recommendation is an analytical assessment. Decision is a management action. They must use different labels and must not be collapsed into one ambiguous badge.

Status pills use a common minimum height, padding, type size and accessible dark text.

## Single-location report

Order:

1. one merged premium hero;
2. executive decision summary;
3. core facts;
4. technical parameters;
5. executive financial section;
6. traffic;
7. competitors;
8. conclusions/tasks when meaningful;
9. photographs.

Hero composition:

- left: brand metadata, title, address, context, executive conclusion and next action;
- right: recommendation, final decision, three authoritative metrics and optional lead image;
- no second large location header;
- no repeated decision strip;
- no empty lead-photo placeholder.

Executive summary:

- one wide conclusion block;
- three lighter columns for strengths, risks and next step;
- only existing source data is used;
- missing information is stated neutrally.

## Full portfolio report

Order:

1. premium portfolio hero;
2. portfolio executive summary;
3. top-location shortlist;
4. risk and missing-data overview;
5. compact collapsible comparison;
6. collapsible detailed location dossiers.

Shortlist:

- maximum three locations;
- rank, name, recommendation, score, completion, decision and one source-grounded insight.

Missing-data overview:

- low-completion or undecided locations are separated from the shortlist;
- each row shows location, completion and next required action.

Collapsed dossier summary:

- rank;
- name and address;
- score, weight and completion;
- decision;
- one concise insight;
- maximum one recommendation pill.

Internal dossier sections use editorial headings and flat rows. They do not imitate top-level location cards.

## Financial section

Primary row:

1. monthly revenue;
2. operating profit;
3. opening investment;
4. payback period.

Secondary breakdown:

- gross margin;
- taxes;
- gross profit;
- fixed costs;
- payroll;
- marketing;
- logistics;
- other OPEX;
- initial stock;
- working capital;
- break-even revenue.

A single restrained ratio bar may show rent burden. It is explanatory, not dashboard decoration.

When revenue or margin is missing, one concise empty state replaces all zero-value rows.

## Photographs

- one optional lead image in the single-location hero;
- 4:3 gallery images with consistent cropping;
- concise captions;
- no large empty gallery;
- collapsed full-report dossiers defer image hydration until expansion;
- all images hydrate before print.

## Mobile rules

At 390 px:

- hero stacks into one column;
- title remains at least 36 px;
- metrics stack without overflow;
- long addresses wrap naturally;
- status pills remain inside the viewport;
- accordion headers remain readable;
- tables use an intentional horizontal scroll container;
- ordinary visible text remains at or above the mobile minimum.

## Print rules

- A4 portrait with explicit margins;
- hero becomes a clean print cover;
- portfolio executive summary ends the opening overview page;
- each location dossier starts on a clean page;
- entire long dossiers are not forced into `break-inside: avoid`;
- section headings stay with the following content;
- fields, financial metric blocks, photos and mini-list items avoid awkward splits;
- all accordion content prints expanded;
- chevrons and interactive affordances are hidden;
- tables fit within the printable width;
- photo figures do not split.

## Accessibility rules

- text and status colours meet readable contrast against their backgrounds;
- buttons keep native keyboard activation;
- accordion buttons expose `aria-expanded` and `aria-controls`;
- focus-visible outlines are explicit;
- status text is not encoded by colour alone;
- user content is inserted with `textContent`, never through dynamic `innerHTML`;
- version-like user text is never rewritten;
- generator metadata is updated only in known generator-owned nodes.
