#' Interactive D3.js Kaplan-Meier survival plot
#'
#' Renders survival curves as an interactive SVG using D3.js v5, from either a
#' \code{survfit} object or a data frame of pre-computed curve rows.  Supports
#' single-arm and stratified curves, brush-to-zoom, hover tooltips, an
#' annotation table (cohort, median, p-value) and a number-at-risk table.  For
#' a wrapper that fits the model from patient-level data and fills in the
#' medians, p-value and at-risk table for you, see \code{\link{rd3survival_km}}.
#'
#' @import htmlwidgets
#'
#' @param sf Either a \code{survfit} object (single-arm \code{~ 1} or
#'   stratified), or a data frame of curve rows with columns \code{time} and
#'   \code{estimate}, and optionally \code{conf.low}, \code{conf.high},
#'   \code{n.risk}, \code{n.censor} and \code{strata} (the layout of
#'   \code{broom::tidy(survfit)}).  Censor marks need \code{n.censor}.
#'   The data frame form draws curves computed elsewhere, e.g. already
#'   truncated or with masked counts; \code{n.risk} may be character.
#' @param bg_color Background colour of the SVG as a CSS colour string.
#'   Default \code{"#232b2b"} (dark charcoal).
#' @param colors Character vector of colours, one per strata, in the order the
#'   strata first appear in the curve rows.  \code{NULL} uses the D3
#'   category-10 palette.
#' @param title Chart title rendered above the plot area.
#' @param xlim,ylim Numeric vectors of length 2 setting the axis limits.
#'   Default: the observed time range and CI range.
#' @param medians Median annotations: a data frame with columns \code{strata}
#'   (matching the curve strata), \code{median}, and optionally \code{lower},
#'   \code{upper} (the CI) and \code{n} (shown as "(N=n)"; may be character).
#'   \code{NA} medians show as "NR".  Without it the chart shows a plain legend.
#' @param risk_table Number-at-risk table below the plot: a data frame with
#'   columns \code{strata}, \code{time} and \code{n_risk} (may be character,
#'   e.g. masked counts).
#' @param p_value Pre-formatted p-value string shown in the annotation table.
#' @param subtitle Subtitle rendered below the title.
#' @param title_x,subtitle_x Horizontal start of the title / subtitle as a
#'   proportion of the SVG width (0-1).  \code{NULL} centres it.
#' @param endpoint,time_unit Endpoint label and unit for the median column
#'   header, e.g. \code{"OS"} and \code{"Months"} give "OS (Months)".
#' @param x_label,y_label Axis titles.
#' @param x_breaks Numeric vector of x-axis tick positions (also where
#'   \code{risk_table} counts are expected).
#' @param y_format D3 format string for y-axis ticks, e.g. \code{".0\%"}
#'   (default \code{".2\%"}).
#' @param y_tick_count Number of evenly spaced y-axis ticks from 0 to 1.
#'   Default 5 (0\%, 25\%, ..., 100\%).
#' @param color_contrast \code{"WoB"} (white on black, default) or
#'   \code{"BoW"} (black on white).
#' @param title_font_size,subtitle_font_size Title / subtitle size in px
#'   (defaults 16 and 12).
#' @param axis_font_size Axis tick-label size in px (default 10).
#' @param axis_label_font_size Axis title size in px (default 13).
#' @param annotation_font_size Annotation table (and legend) size in px
#'   (default 12).  Rows and columns resize to fit.
#' @param risk_font_size Number-at-risk table size in px (default 11).
#' @param conf_int Logical.  Shade the 95\% CI band around each curve.
#'   Default \code{TRUE}.
#' @param show_median Logical.  Show the median column of the annotation
#'   table.  Default \code{TRUE}.
#' @param show_median_ci Logical.  Include the CI, "(lower, upper)", after
#'   each median.  Default \code{TRUE}.
#' @param show_median_lines Logical.  Draw the dashed 50\% line and a dashed
#'   vertical line at each median.  Defaults to \code{show_median}.
#' @param show_p_value Logical.  Show the P-value column (only drawn when a
#'   \code{p_value} is given).  Default \code{TRUE}.
#' @param censor_marks Logical.  Draw a short vertical tick on the curve at
#'   each time with \code{n.censor > 0}: one tick per time, however many were
#'   censored then.  Default \code{TRUE}.  A data-frame \code{sf} without an
#'   \code{n.censor} column draws none.
#' @param censor_size Height of a censor tick in px (default 8).
#' @param opts Named list of further renderer options.  Named arguments take
#'   precedence over the same key in \code{opts}.
#' @param width,height Widget width and height as a CSS unit string or pixel
#'   integer.  \code{NULL} (default) fills the containing element.
#' @param elementId Optional fixed HTML element ID for the widget.
#'
#' @return An \code{htmlwidget} object that renders in the RStudio / Positron
#'   Viewer, R Markdown and Quarto documents, and Shiny apps.  Use
#'   \code{\link[htmlwidgets]{saveWidget}} to export a self-contained HTML file.
#'
#' @seealso \code{\link{rd3survival_km}} for a higher-level wrapper;
#'   \code{\link[survival]{survfit}} for fitting the model.
#'
#' @examples
#' library(survival)
#' lung2 <- lung
#' lung2$status <- lung2$status - 1
#'
#' # Single-arm
#' sf <- survfit(Surv(time, status) ~ 1, data = lung2)
#' rd3survival(sf)
#'
#' # Stratified with custom colours, bigger text, no CI shading
#' lung2$sex_label <- ifelse(lung2$sex == 1, "Male", "Female")
#' sf2 <- survfit(Surv(time, status) ~ sex_label, data = lung2)
#' rd3survival(sf2,
#'   title    = "Overall Survival by Sex",
#'   bg_color = "#1a1a2e",
#'   colors   = c("#e94560", "#0f3460"),
#'   axis_font_size = 14, title_font_size = 20,
#'   conf_int = FALSE
#' )
#'
#' # Pre-computed curve rows with your own medians and at-risk counts
#' tbl  <- summary(sf2)$table
#' risk <- summary(sf2, times = c(0, 500, 1000), extend = TRUE)
#' rd3survival(broom::tidy(sf2),
#'   medians    = data.frame(strata = rownames(tbl), median = tbl[, "median"],
#'                           lower = tbl[, "0.95LCL"], upper = tbl[, "0.95UCL"],
#'                           n = tbl[, "records"]),
#'   risk_table = data.frame(strata = risk$strata, time = risk$time, n_risk = risk$n.risk),
#'   x_breaks = c(0, 500, 1000), endpoint = "OS", time_unit = "Days",
#'   show_median_ci = FALSE)
#'
#' @export
rd3survival <- function(sf,
                        bg_color = NULL,
                        colors   = NULL,
                        title    = NULL,
                        xlim     = NULL,
                        ylim     = NULL,
                        medians    = NULL,
                        risk_table = NULL,
                        p_value    = NULL,
                        subtitle   = NULL,
                        title_x    = NULL,
                        subtitle_x = NULL,
                        endpoint   = NULL,
                        time_unit  = NULL,
                        x_label    = NULL,
                        y_label    = NULL,
                        x_breaks   = NULL,
                        y_format   = NULL,
                        y_tick_count   = NULL,
                        color_contrast = NULL,
                        title_font_size      = NULL,
                        subtitle_font_size   = NULL,
                        axis_font_size       = NULL,
                        axis_label_font_size = NULL,
                        annotation_font_size = NULL,
                        risk_font_size       = NULL,
                        conf_int          = TRUE,
                        show_median       = TRUE,
                        show_median_ci    = TRUE,
                        show_median_lines = show_median,
                        show_p_value      = TRUE,
                        censor_marks      = TRUE,
                        censor_size       = NULL,
                        opts     = list(),
                        width    = NULL,
                        height   = NULL,
                        elementId = NULL) {

  if (!is.null(color_contrast) && color_contrast == "BoW" && is.null(bg_color))
    bg_color <- "#ffffff"

  named <- list(
    bg_color = bg_color, colors = if (!is.null(colors)) as.list(colors), title = title,
    xlim = xlim, ylim = ylim,
    medians = rd3s_medians(medians, ci = show_median_ci), risk_table = rd3s_risk(risk_table),
    p_value = p_value, subtitle = subtitle, title_x = title_x, subtitle_x = subtitle_x,
    endpoint = endpoint, time_unit = time_unit, x_label = x_label, y_label = y_label,
    x_breaks = x_breaks, y_format = y_format, y_tick_count = y_tick_count,
    color_contrast = color_contrast,
    title_font_size = title_font_size, subtitle_font_size = subtitle_font_size,
    axis_font_size = axis_font_size, axis_label_font_size = axis_label_font_size,
    annotation_font_size = annotation_font_size, risk_font_size = risk_font_size,
    conf_int = conf_int, show_median = show_median, show_median_lines = show_median_lines,
    show_p_value = show_p_value, censor_marks = censor_marks, censor_size = censor_size)
  # Named arguments win over opts; NULL ones leave opts (and the renderer's defaults) alone.
  named <- named[!vapply(named, is.null, logical(1))]
  opts[names(named)] <- named

  x <- list(data = jsonlite::toJSON(rd3s_curve_rows(sf)), options = opts)

  htmlwidgets::createWidget(
    name = 'rd3survival',
    x,
    width = width,
    height = height,
    package = 'rd3survival',
    elementId = elementId
  )
}

#' Shiny bindings for rd3survival
#'
#' Output and render functions for using rd3survival within Shiny
#' applications and interactive Rmd documents.
#'
#' @param outputId output variable to read from
#' @param width,height Must be a valid CSS unit (like \code{'100\%'},
#'   \code{'400px'}, \code{'auto'}) or a number, which will be coerced to a
#'   string and have \code{'px'} appended.
#' @param expr An expression that generates a rd3survival
#' @param env The environment in which to evaluate \code{expr}.
#' @param quoted Is \code{expr} a quoted expression (with \code{quote()})? This
#'   is useful if you want to save an expression in a variable.
#'
#' @name rd3survival-shiny
#'
#' @export
rd3survivalOutput <- function(outputId, width = '100%', height = '400px'){
  htmlwidgets::shinyWidgetOutput(outputId, 'rd3survival', width, height, package = 'rd3survival')
}

#' @rdname rd3survival-shiny
#' @export
renderRd3survival <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  htmlwidgets::shinyRenderWidget(expr, rd3survivalOutput, env, quoted = TRUE)
}
