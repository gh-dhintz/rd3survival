#' Kaplan-Meier survival plot from a data frame (survminer-style API)
#'
#' High-level wrapper around \code{\link{rd3survival}} that accepts a raw data
#' frame and column names, fits the Kaplan-Meier model internally, and
#' enriches the chart with:
#' \itemize{
#'   \item a \strong{k × 3 annotation table} (Cohort | Endpoint (unit) | P-value),
#'   \item dashed \strong{median crosshairs} per strata,
#'   \item a \strong{number-at-risk table} below the plot, and
#'   \item a \strong{log-rank p-value} for stratified comparisons.
#' }
#' All rendering is performed by the D3.js engine; R only prepares the data
#' and computes summary statistics.
#'
#' @param df A data frame containing at minimum the time and event columns.
#' @param time_var Name (string) of the column holding follow-up time.
#' @param event_var Name (string) of the column holding the event indicator
#'   (0 = censored, 1 = event).
#' @param strat_var Name (string) of the column to stratify by.  When
#'   \code{NULL} (default) a single-arm curve is drawn.
#' @param color A single CSS colour string (single-arm) or a character vector
#'   of colours with one element per level of \code{strat_var} (in factor
#'   order).  \code{NULL} uses the D3 category-10 palette.
#' @param title Chart title.
#' @param subtitle Optional subtitle rendered in smaller text below the title.
#' @param title_x Horizontal start position of the title as a proportion of
#'   the total SVG width (0 = far left, 1 = far right).  \code{NULL} (default)
#'   centres the title.
#' @param subtitle_x Horizontal start position of the subtitle on the same
#'   0–1 scale.  \code{NULL} (default) centres the subtitle.
#' @param title_font_size Title font size in pixels.  \code{NULL} uses the
#'   CSS default (16 px).
#' @param subtitle_font_size Subtitle font size in pixels.  \code{NULL} uses
#'   the CSS default (12 px).
#' @param endpoint Short endpoint label shown in the annotation table header,
#'   e.g. \code{"OS"}, \code{"PFS"}.
#' @param time_unit Time unit appended to the endpoint label in parentheses,
#'   e.g. \code{"Months"}, \code{"Days"}.
#' @param x_label X-axis label.  Default \code{"Time (months)"}.
#' @param y_label Y-axis label.  Defaults to
#'   \code{paste0("Probability of ", event_var)}.
#' @param x_break_every Numeric interval between x-axis tick marks and
#'   number-at-risk columns.  Default \code{4}.
#' @param show_median Logical.  When \code{TRUE} (default), draws dashed
#'   median crosshairs and the annotation table.
#' @param conf_int Logical.  When \code{TRUE} (default), shades 95\%
#'   confidence-interval bands around each curve.
#' @param y_tick_count Approximate number of y-axis ticks.  Default \code{5}
#'   produces ticks at roughly 0\%, 25\%, 50\%, 75\%, 100\%.  Passed to
#'   D3's \code{axis.ticks(n)}; the actual count may differ slightly.
#' @param y_format D3 format string controlling y-axis tick labels:
#'   \describe{
#'     \item{\code{".2\%"}}{100.00\% (default)}
#'     \item{\code{".0\%"}}{100\%}
#'     \item{\code{".2f"}}{1.00}
#'     \item{\code{".0f"}}{1}
#'   }
#' @param bg_color SVG background colour as a CSS colour string.  Default
#'   \code{"#232b2b"}.
#' @param width,height Widget dimensions passed to
#'   \code{\link[htmlwidgets]{createWidget}}.  \code{NULL} fills the container.
#' @param elementId Optional fixed HTML element ID for the widget.
#'
#' @return An \code{htmlwidget} object.  See \code{\link{rd3survival}} for
#'   rendering and export details.
#'
#' @details
#' \strong{Patient counts:} if \code{df} contains a column named
#' \code{upk_key}, unique values are counted; otherwise \code{nrow(df)} is
#' used.  This accommodates datasets where multiple rows per patient exist.
#'
#' \strong{Log-rank p-value:} computed via
#' \code{\link[survival]{survdiff}} only when \code{strat_var} is supplied.
#' Formatted as \code{"< 0.001"} or three decimal places.
#'
#' \strong{Medians:} extracted from \code{summary(survfit)$table}.  \code{NA}
#' medians (curve never reaches 50\%) are displayed as \code{"NR"}.
#'
#' \strong{Number at risk:} evaluated at each x-break via
#' \code{summary(survfit, times = x_breaks, extend = TRUE)}.
#'
#' @seealso \code{\link{rd3survival}} for the lower-level widget;
#'   \code{\link[survival]{survfit}}, \code{\link[survival]{survdiff}}.
#'
#' @examples
#' library(survival)
#' lung2 <- lung
#' lung2$status     <- lung2$status - 1
#' lung2$sex_label  <- ifelse(lung2$sex == 1, "Male", "Female")
#'
#' # Single-arm
#' rd3survival_km(lung2, time_var = "time", event_var = "status",
#'                title = "Overall Survival", endpoint = "OS",
#'                time_unit = "Days", x_break_every = 100)
#'
#' # Stratified with annotation table and risk table
#' rd3survival_km(lung2,
#'   time_var      = "time",
#'   event_var     = "status",
#'   strat_var     = "sex_label",
#'   color         = c("#e94560", "#0f3460"),
#'   title         = "Overall Survival by Sex",
#'   subtitle      = "NCCTG Lung Cancer Dataset",
#'   title_x       = 0.08,
#'   subtitle_x    = 0.08,
#'   endpoint      = "OS",
#'   time_unit     = "Days",
#'   x_break_every = 100,
#'   y_format      = ".0%",
#'   bg_color      = "#1a1a2e"
#' )
#'
#' @export
rd3survival_km <- function(df,
                           time_var,
                           event_var,
                           strat_var     = NULL,
                           color         = NULL,
                           title         = NULL,
                           endpoint      = NULL,
                           time_unit     = NULL,
                           x_label       = "Time (months)",
                           y_label       = NULL,
                           x_break_every = 4,
                           show_median   = TRUE,
                           conf_int      = TRUE,
                           y_format      = NULL,
                           y_tick_count  = 5,
                           subtitle         = NULL,
                           title_x          = NULL,
                           subtitle_x       = NULL,
                           title_font_size  = NULL,
                           subtitle_font_size = NULL,
                           color_contrast = NULL,
                           bg_color      = NULL,
                           width         = NULL,
                           height        = NULL,
                           elementId     = NULL) {

  if (is.null(y_label)) y_label <- paste0("Probability of ", event_var)
  if (!is.null(color_contrast) && color_contrast == "BoW" && is.null(bg_color)) {
    bg_color <- "#ffffff"
  }

  rhs <- if (is.null(strat_var)) "1" else strat_var
  surv_formula <- as.formula(
    paste0("survival::Surv(", time_var, ", ", event_var, ") ~ ", rhs)
  )
  surv_obj <- survival::survfit(surv_formula, data = df)

  max_time <- max(df[[time_var]], na.rm = TRUE)
  x_breaks <- seq(0, ceiling(max_time), by = x_break_every)

  n_patients <- if ("upk_key" %in% names(df)) {
    length(unique(df[["upk_key"]]))
  } else {
    nrow(df)
  }

  fmt_median <- function(med, lcl, ucl, dec = 1) {
    f <- function(v) if (is.na(v)) "NR" else as.character(round(v, dec))
    paste0(f(med), " (", f(lcl), ", ", f(ucl), ")")
  }

  # Log-rank p-value (only meaningful for stratified)
  p_value <- NULL
  if (!is.null(strat_var)) {
    sd     <- survival::survdiff(surv_formula, data = df)
    p_raw  <- 1 - pchisq(sd$chisq, df = length(sd$n) - 1)
    p_value <- if (p_raw < 0.001) "< 0.001" else formatC(p_raw, digits = 3, format = "f")
  }

  tbl <- summary(surv_obj)$table

  if (is.null(strat_var)) {
    medians <- list(list(
      strata = "series",
      val    = if (is.na(tbl[["median"]])) NULL else as.numeric(tbl[["median"]]),
      label  = fmt_median(tbl[["median"]], tbl[["0.95LCL"]], tbl[["0.95UCL"]]),
      n      = n_patients
    ))
  } else {
    strata_n <- sapply(levels(factor(df[[strat_var]])), function(v) {
      sub_df <- df[df[[strat_var]] == v, ]
      if ("upk_key" %in% names(sub_df)) length(unique(sub_df[["upk_key"]])) else nrow(sub_df)
    })
    names(strata_n) <- paste0(strat_var, "=", names(strata_n))

    medians <- lapply(seq_len(nrow(tbl)), function(i) {
      rn <- rownames(tbl)[i]
      list(
        strata = rn,
        val    = if (is.na(tbl[i, "median"])) NULL else as.numeric(tbl[i, "median"]),
        label  = fmt_median(tbl[i, "median"], tbl[i, "0.95LCL"], tbl[i, "0.95UCL"]),
        n      = as.integer(strata_n[[rn]])
      )
    })
  }

  # Risk table: n.risk at each x-break per strata
  risk_sum <- summary(surv_obj, times = x_breaks, extend = TRUE)
  if (is.null(strat_var)) {
    risk_df <- data.frame(
      strata = "series",
      time   = risk_sum$time,
      n_risk = risk_sum$n.risk,
      stringsAsFactors = FALSE
    )
  } else {
    risk_df <- data.frame(
      strata = as.character(risk_sum$strata),
      time   = risk_sum$time,
      n_risk = risk_sum$n.risk,
      stringsAsFactors = FALSE
    )
  }
  risk_table <- lapply(seq_len(nrow(risk_df)), function(i) {
    list(strata = risk_df$strata[i], time = risk_df$time[i], n_risk = risk_df$n_risk[i])
  })

  rd3survival(
    surv_obj,
    colors    = color,
    title     = title,
    bg_color  = bg_color,
    width     = width,
    height    = height,
    elementId = elementId,
    opts = list(
      x_label     = x_label,
      y_label     = y_label,
      x_breaks    = x_breaks,
      n_patients  = n_patients,
      medians     = medians,
      show_median = show_median,
      conf_int    = conf_int,
      endpoint    = endpoint,
      time_unit   = time_unit,
      p_value     = p_value,
      risk_table  = risk_table,
      y_format     = y_format,
      y_tick_count = y_tick_count,
      color_contrast     = color_contrast,
      subtitle           = subtitle,
      title_x            = title_x,
      subtitle_x         = subtitle_x,
      title_font_size    = title_font_size,
      subtitle_font_size = subtitle_font_size
    )
  )
}
