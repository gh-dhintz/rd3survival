#' Interactive D3.js Kaplan-Meier survival plot
#'
#' Renders a \code{survfit} object as an interactive SVG survival curve using
#' D3.js v5.  Supports single-arm and stratified fits, brush-to-zoom, and
#' hover tooltips.  For a higher-level wrapper that accepts a raw data frame
#' and computes the fit for you, see \code{\link{rd3survival_km}}.
#'
#' @import htmlwidgets
#'
#' @param sf A \code{survfit} object produced by
#'   \code{\link[survival]{survfit}}.  Both single-arm (\code{~ 1}) and
#'   stratified (\code{~ strat_var}) fits are supported.
#' @param bg_color Background colour of the SVG as a CSS colour string.
#'   Default \code{"#232b2b"} (dark charcoal).
#' @param colors Character vector of hex or named CSS colours, one per strata,
#'   applied in the order strata appear in \code{sf}.  When \code{NULL}
#'   (default) the D3 category-10 palette is used.
#' @param title Chart title rendered above the plot area.
#' @param xlim Numeric vector of length 2 setting the x-axis limits
#'   \code{c(min, max)}.  Defaults to the observed time range.
#' @param ylim Numeric vector of length 2 setting the y-axis limits
#'   \code{c(min, max)}.  Defaults to the observed survival probability range.
#' @param opts Named list of additional options passed directly to the
#'   JavaScript renderer.  Useful keys (all optional):
#'   \describe{
#'     \item{\code{x_breaks}}{Numeric vector of explicit x-axis tick positions.}
#'     \item{\code{x_label}}{X-axis label string.}
#'     \item{\code{y_label}}{Y-axis label string.}
#'     \item{\code{y_format}}{D3 format string for y-axis ticks, e.g.
#'       \code{".0\%"} (default \code{".2\%"}).}
#'     \item{\code{conf_int}}{Logical. Show confidence-interval bands
#'       (default \code{TRUE}).}
#'     \item{\code{show_median}}{Logical. Draw dashed median crosshairs and
#'       annotation table (default \code{TRUE}).}
#'     \item{\code{medians}}{List of per-strata median objects produced by
#'       \code{rd3survival_km}. Each element: \code{list(strata, val, label, n)}.}
#'     \item{\code{n_patients}}{Integer total patient count shown as "N = X".}
#'     \item{\code{endpoint}}{Endpoint label for the annotation table
#'       (e.g. \code{"OS"}).}
#'     \item{\code{time_unit}}{Time unit label (e.g. \code{"Months"}).}
#'     \item{\code{p_value}}{Pre-formatted log-rank p-value string.}
#'     \item{\code{risk_table}}{List of \code{list(strata, time, n_risk)}
#'       records for the at-risk table below the plot.}
#'     \item{\code{subtitle}}{Subtitle string rendered below the title.}
#'     \item{\code{title_x}}{Title x start as a proportion of total SVG width
#'       (0–1). \code{NULL} centres the title.}
#'     \item{\code{subtitle_x}}{Subtitle x start proportion. \code{NULL}
#'       centres the subtitle.}
#'     \item{\code{title_font_size}}{Title font size in pixels.}
#'     \item{\code{subtitle_font_size}}{Subtitle font size in pixels.}
#'   }
#' @param width,height Widget width and height as a valid CSS unit string or
#'   pixel integer.  \code{NULL} (default) fills the containing element.
#' @param elementId Optional fixed HTML element ID for the widget.
#'
#' @return An \code{htmlwidget} object that renders in the RStudio Viewer,
#'   R Markdown documents, and Shiny apps.  Use
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
#' # Stratified with custom colours
#' lung2$sex_label <- ifelse(lung2$sex == 1, "Male", "Female")
#' sf2 <- survfit(Surv(time, status) ~ sex_label, data = lung2)
#' rd3survival(sf2,
#'   title    = "Overall Survival by Sex",
#'   bg_color = "#1a1a2e",
#'   colors   = c("#e94560", "#0f3460")
#' )
#'
#' @export
rd3survival <- function(sf,
                        bg_color = NULL,
                        colors   = NULL,
                        title    = NULL,
                        xlim     = NULL,
                        ylim     = NULL,
                        opts     = list(),
                        width    = NULL,
                        height   = NULL,
                        elementId = NULL) {

  library(magrittr)
  library(dplyr)
  library(broom)

  prepData <- function(sf) {
    tsf <- broom::tidy(sf)
    jsonlite::toJSON(tsf)
  }

  # Merge named params into opts (named params take precedence over opts)
  if (!is.null(bg_color)) opts$bg_color <- bg_color
  if (!is.null(colors))   opts$colors   <- as.list(colors)
  if (!is.null(title))    opts$title    <- title
  if (!is.null(xlim))     opts$xlim     <- xlim
  if (!is.null(ylim))     opts$ylim     <- ylim

  # forward options using x
  x = list(
    data = prepData(sf),
    options = opts
  )

  # create widget
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
