# rd3survival

An R htmlwidget that renders interactive Kaplan-Meier survival curves using D3.js v5.  Plots are fully self-contained SVGs that embed in R Markdown, Quarto, Shiny, and standalone HTML files.

## Features

- Single-arm and stratified Kaplan-Meier curves
- Brush-to-zoom with double-click reset
- Hover tooltip: survival probability, 95% CI, and number at risk at any time point
- Per-strata median crosshairs (dashed lines at t = median, S = 0.5)
- k × 3 annotation table: Cohort | Endpoint (unit) | P-value
- Log-rank p-value (stratified fits)
- Number-at-risk table below the plot (ggsurvplot-style)
- Confidence-interval bands (toggleable)
- Dark (`"WoB"`) and light (`"BoW"`) colour-contrast themes
- Fully customisable colours, axis labels, title/subtitle, and font sizes

For a full walkthrough with screenshots of every feature, see the [Getting Started vignette](vignettes/rd3survival.Rmd).  After installing the package, open it in R with:

```r
vignette("rd3survival", package = "rd3survival")
```

## Installation

```r
# Install dependencies
install.packages(c("survival", "broom", "dplyr", "jsonlite", "htmlwidgets"))

# Install rd3survival from GitHub
remotes::install_github("gh-dhintz/rd3survival")
```

## Quick start

### High-level wrapper — `rd3survival_km()`

The easiest way to use the package.  Pass a data frame and column names; the function fits the model, computes medians and p-values, and passes everything to D3.

```r
library(survival)
library(rd3survival)

lung2 <- lung
lung2$status    <- lung2$status - 1          # recode to 0/1
lung2$sex_label <- ifelse(lung2$sex == 1, "Male", "Female")

rd3survival_km(
  df            = lung2,
  time_var      = "time",
  event_var     = "status",
  strat_var     = "sex_label",
  color         = c("#e94560", "#0f3460"),
  title         = "Overall Survival by Sex",
  subtitle      = "NCCTG Lung Cancer Dataset",
  title_x       = 0.08,
  subtitle_x    = 0.08,
  endpoint      = "OS",
  time_unit     = "Days",
  x_break_every = 100,
  y_format      = ".0%",
  bg_color      = "#1a1a2e"
)
```

### Low-level widget — `rd3survival()`

Pass a `survfit` object directly when you need full control or already have a fitted model.

```r
sf <- survfit(Surv(time, status) ~ sex_label, data = lung2)

rd3survival(
  sf,
  title    = "Overall Survival by Sex",
  bg_color = "#1a1a2e",
  colors   = c("#e94560", "#0f3460")
)
```

### Save to HTML

```r
p <- rd3survival_km(lung2, "time", "status")
htmlwidgets::saveWidget(p, "km.html", selfcontained = TRUE)
```

## Function reference

### `rd3survival_km()`

| Argument | Type | Default | Description |
|---|---|---|---|
| `df` | data.frame | — | Data frame with time and event columns |
| `time_var` | string | — | Column name for follow-up time |
| `event_var` | string | — | Column name for event indicator (0/1) |
| `strat_var` | string | `NULL` | Column name for stratification; `NULL` = single-arm |
| `color` | character | `NULL` | One colour per strata; `NULL` uses D3 category-10 |
| `title` | string | `NULL` | Chart title |
| `subtitle` | string | `NULL` | Subtitle rendered below the title |
| `title_x` | 0–1 | `NULL` | Title horizontal start position (proportion of SVG width); `NULL` centres |
| `subtitle_x` | 0–1 | `NULL` | Subtitle horizontal start position; `NULL` centres |
| `title_font_size` | numeric | `NULL` | Title font size in px (default 16) |
| `subtitle_font_size` | numeric | `NULL` | Subtitle font size in px (default 12) |
| `axis_font_size` | numeric | `NULL` | Axis tick-label font size in px (default 10) |
| `axis_label_font_size` | numeric | `NULL` | Axis title font size in px (default 13) |
| `annotation_font_size` | numeric | `NULL` | Annotation table font size in px (default 12); rows and columns resize to fit |
| `risk_font_size` | numeric | `NULL` | Number-at-risk table font size in px (default 11) |
| `endpoint` | string | `NULL` | Endpoint label for annotation table (e.g. `"OS"`) |
| `time_unit` | string | `NULL` | Time unit for annotation table (e.g. `"Months"`) |
| `x_label` | string | `"Time (months)"` | X-axis label |
| `y_label` | string | auto | Y-axis label; defaults to `"Probability of <event_var>"` |
| `x_break_every` | numeric | `4` | Interval between x-axis ticks and risk-table columns |
| `show_median` | logical | `TRUE` | Show the median column of the annotation table |
| `show_median_ci` | logical | `TRUE` | Show the 95% CI after each median |
| `show_median_lines` | logical | `show_median` | Draw the dashed 50% line and median crosshairs |
| `show_p_value` | logical | `TRUE` | Show the log-rank p-value column (stratified only) |
| `conf_int` | logical | `TRUE` | Shade the 95% CI band around each curve |
| `y_format` | string | `".2%"` | D3 format for y-axis ticks (see table below) |
| `y_tick_count` | numeric | `5` | Number of y-axis ticks (default gives 0%, 25%, 50%, 75%, 100%) |
| `color_contrast` | string | `NULL` | `"WoB"` = white on black (default); `"BoW"` = black on white |
| `bg_color` | string | `"#232b2b"` | SVG background colour (overridden by `color_contrast`) |
| `width`, `height` | CSS/px | `NULL` | Widget dimensions; `NULL` fills container |
| `elementId` | string | `NULL` | Fixed HTML element ID |

**`y_format` values**

| Value | Display |
|---|---|
| `".2%"` | 100.00% (default) |
| `".0%"` | 100% |
| `".2f"` | 1.00 |
| `".0f"` | 1 |

### `rd3survival()`

Lower-level entry point. `sf` is a `survfit` object **or** a data frame of pre-computed curve rows (`time`, `estimate`, and optionally `conf.low`, `conf.high`, `n.risk`, `strata`), for curves computed elsewhere (e.g. truncated, or with masked counts).

It takes the same display arguments as `rd3survival_km()`: the fonts, the `show_*` switches, `conf_int`, `y_tick_count` and so on. It also takes `colors`, `xlim` and `ylim`, plus the annotations as plain data frames:

- `medians`: `strata`, `median`, and optionally `lower`, `upper`, `n`.
- `risk_table`: `strata`, `time`, `n_risk`.
- `p_value`: a pre-formatted string.

See `?rd3survival`.

## Interactivity

| Interaction | Behaviour |
|---|---|
| Hover over plot | Tooltip showing t, survival %, 95% CI, and at-risk count per strata |
| Click and drag | Brush-zoom to selected region |
| Click without drag | Reset zoom to full extent |

## Shiny

```r
library(shiny)
library(rd3survival)

ui <- fluidPage(
  rd3survivalOutput("plot", height = "500px")
)

server <- function(input, output) {
  output$plot <- renderRd3survival({
    rd3survival_km(lung2, "time", "status", strat_var = "sex_label")
  })
}

shinyApp(ui, server)
```

## License

MIT
