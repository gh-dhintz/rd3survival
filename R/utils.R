# Internal helpers shared by rd3survival() and rd3survival_km().

# "12.3 (10.1, 15.0)", NA -> "NR"; ci = FALSE drops the bracket.
rd3s_fmt_median <- function(med, lcl, ucl, ci = TRUE, dec = 1) {
  f <- function(v) ifelse(is.na(v), "NR", as.character(round(v, dec)))
  if (ci) paste0(f(med), " (", f(lcl), ", ", f(ucl), ")") else f(med)
}

# Medians for the annotation table: a data frame (strata, median, lower, upper[, n]) is turned
# into the records the renderer reads; a list of records (the old opts$medians form) passes as is.
rd3s_medians <- function(medians, ci = TRUE) {
  if (is.null(medians) || !is.data.frame(medians)) return(medians)
  need <- c("strata", "median")
  if (!all(need %in% names(medians)))
    stop("`medians` needs columns strata and median (optionally lower, upper, n)", call. = FALSE)
  if (is.null(medians$lower)) medians$lower <- NA_real_
  if (is.null(medians$upper)) medians$upper <- NA_real_
  lapply(seq_len(nrow(medians)), function(i) {
    m <- medians[i, , drop = FALSE]
    rec <- list(strata = as.character(m$strata),
                val    = if (is.na(m$median)) NULL else as.numeric(m$median),
                label  = rd3s_fmt_median(m$median, m$lower, m$upper, ci = ci))
    if (!is.null(m$n) && !is.na(m$n)) rec$n <- m$n
    rec
  })
}

# Number-at-risk rows: a data frame (strata, time, n_risk) or the old list-of-records form.
rd3s_risk <- function(risk_table) {
  if (is.null(risk_table) || !is.data.frame(risk_table)) return(risk_table)
  if (!all(c("strata", "time", "n_risk") %in% names(risk_table)))
    stop("`risk_table` needs columns strata, time and n_risk", call. = FALSE)
  lapply(seq_len(nrow(risk_table)), function(i)
    list(strata = as.character(risk_table$strata[i]), time = risk_table$time[i],
         n_risk = risk_table$n_risk[i]))
}

# Curve rows for the renderer, from a survfit or from a data frame of pre-computed rows.
rd3s_curve_rows <- function(sf) {
  if (inherits(sf, "survfit")) return(broom::tidy(sf))
  if (!is.data.frame(sf))
    stop("`sf` must be a survfit object or a data frame of curve rows", call. = FALSE)
  if (!all(c("time", "estimate") %in% names(sf)))
    stop("a data frame `sf` needs columns time and estimate ",
         "(optionally conf.low, conf.high, n.risk, strata)", call. = FALSE)
  sf <- as.data.frame(sf)
  if ("strata" %in% names(sf)) sf$strata <- as.character(sf$strata)
  sf
}
