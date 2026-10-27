// d3Survival is written for d3 v5 (d3.nest, d3.event, d3.mouse were removed in v6). It runs
// against the d3 v5 that d3.min.js just loaded, captured here as a local `d3`, and exposed only as
// window.rd3survival_d3 -- so another d3 version on the page (before or after) cannot replace it.
(function(d3) {

d3.survival = function(message) {
  
  var margin = {top:30,left:75,bottom:50,right:40},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom,
    xlim = valPropLen(message.options,'xlim'),
    ylim = valPropLen(message.options,'ylim'),
    lastExtent = [[0,0],[0,0]],
    svg;


  function valPropLen(obj, prop, len) {
    len = len || 2;
    return obj[prop] && obj[prop].length == len ? obj[prop] : null;
  } 

  
  function nestData(data) {
    var nest;
    if(data[0].strata !== undefined) {
      nest = d3.nest()
        .key(function(d) { return d.strata})
        .entries(data);
    } else {
      nest = [{key:'series', values:data}];
    }
    return nest;
  }
  
  var f = function(context) {
    // draw the graph
    context.selectAll('*').remove(); // remove old graphs

    var opts = message.options || {};

    // Optional font sizes (px) from R; null keeps the stylesheet's size.
    function fontSize(sel, key) {
      if (opts[key] != null) sel.style('font-size', opts[key] + 'px');
      return sel;
    }
    var showMedian      = opts.show_median !== false;
    var showMedianLines = opts.show_median_lines != null ? opts.show_median_lines !== false : showMedian;
    var showP           = opts.show_p_value !== false && opts.p_value != null && opts.p_value !== '';

    var isBoW   = opts.color_contrast === 'BoW';
    var fg      = isBoW ? '#111111' : '#e9e9e9';
    var bgColor = isBoW ? '#ffffff' : (opts.bg_color || '#232b2b');

    function dispLabel(key) {
      if (key === 'series') return '';
      var eq = key.indexOf('=');
      return eq >= 0 ? key.substring(eq + 1) : key;
    }

    var nest = nestData(message.data);

    var extraTop = opts.subtitle ? 16 : 0;
    var totalW   = width + margin.left + margin.right;

    var svgEl = context.append('svg')
      .attr('width','100%')
      .attr('height','100%')
      .attr('viewBox','0 0 ' + totalW + ' ' + (height + margin.top + margin.bottom + extraTop))
      .style('background-color', bgColor);

    if (opts.title) {
      var titleX = opts.title_x != null ? opts.title_x * totalW : totalW / 2;
      var titleEl = svgEl.append('text')
        .attr('x', titleX)
        .attr('y', margin.top * 0.75)
        .attr('text-anchor', opts.title_x != null ? 'start' : 'middle')
        .attr('class', 'chart-title')
        .text(opts.title);
      if (opts.title_font_size) titleEl.style('font-size', opts.title_font_size + 'px');
    }

    if (opts.subtitle) {
      var subX = opts.subtitle_x != null ? opts.subtitle_x * totalW : totalW / 2;
      var subEl = svgEl.append('text')
        .attr('x', subX)
        .attr('y', margin.top * 0.75 + 14)
        .attr('text-anchor', opts.subtitle_x != null ? 'start' : 'middle')
        .attr('class', 'chart-subtitle')
        .text(opts.subtitle);
      if (opts.subtitle_font_size) subEl.style('font-size', opts.subtitle_font_size + 'px');
    }

    svg = svgEl.append('g')
      .attr('transform','translate(' + margin.left + ',' + (margin.top + extraTop) + ')')

    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // "time"      "n.risk"    "n.event"   "n.censor"  "estimate"  "std.error" "conf.high" "conf.low"

    var colorScale = opts.colors && opts.colors.length
      ? d3.scaleOrdinal(opts.colors)
      : d3.scaleOrdinal(d3.schemeCategory10);

    var color = colorScale
      .domain(d3.map(nest, function(d) { return d.key}))
      
      
    var domain = {
        x: xlim || d3.extent(message.data, function(d) { return d['time']}),
        y: ylim|| [d3.min(message.data, function(d) { return d['conf.low']}), d3.max(message.data, function(d) { return d["conf.high"]})]
    }

    var x = d3.scaleLinear()
      .domain(domain.x)
      .range([0,width])
      .nice();

    var y = d3.scaleLinear()
      .domain(domain.y)
      .range([height,0])
      .nice();

    var yN     = opts.y_tick_count || 5;
    var yStep  = 1 / (yN - 1);
    var yTicks = d3.range(0, 1 + yStep * 0.001, yStep);
    var yAxis = d3.axisLeft(y).tickValues(yTicks).tickFormat(d3.format(opts.y_format || '.2%')),
        yGrid = d3.axisLeft(y).tickValues(yTicks).tickSizeInner(-width),
        xAxis = d3.axisBottom(x),
        xGrid = d3.axisBottom(x).tickSizeInner(-height);

    if (opts.x_breaks) {
      xAxis.tickValues(opts.x_breaks);
      xGrid.tickValues(opts.x_breaks);
    }
      
    var brush = d3.brush()
      .extent([[0,0],[width,height]])
      .on("end", brushed)
    
      
    svg.append("defs").append("clipPath")
        .attr("id", "limit-clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);
    
    var line = d3.line()
      .x(function(d) { return x(d.time)})
      .y(function(d) { return y(d.estimate)})
      .curve(d3.curveStepAfter)

    var area = d3.area()
      .x(function(d) { return x(d.time)})
      .y0(function(d) { return y(d['conf.low'])})
      .y1(function(d) { return y(d['conf.high'])})
      .curve(d3.curveStepAfter);
      
      
    svg.append('g')
        .classed('grid y',true)
        .call(yGrid)

    svg.append('g')
        .classed('grid x',true)
        .attr('transform','translate(0,' + height + ')')
        .call(xGrid)

    var strata = svg.append('g')
        .attr('clip-path','url(#limit-clip)')
        .selectAll('.strata')
        .data(nest)
        .enter()
        .append('g')


    var conf = strata.append('path')
      .classed('confidence',true)
      .attr('d', function(d) { return area(d.values)})
      .style('fill', function(d) { return color(d.key)})
      .style('display', opts.conf_int === false ? 'none' : null);
      
      
    var estimate = strata.append('path')
      .classed('estimate',true)
      .attr('d', function(d) { return line(d.values)})
      .style('stroke', function(d) { return color(d.key)});
      
      
    svg.append('g')
      .classed('axis x', true)
      .attr('transform','translate(0,' + height + ')')
      .call(xAxis);

    svg.append('g')
      .classed('axis y', true)
      .call(yAxis)

    fontSize(svg.selectAll('.axis text'), 'axis_font_size');

    // Axis labels
    if (opts.x_label) {
      svg.append('text').attr('class', 'axis-label x')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 8)
        .attr('text-anchor', 'middle')
        .text(opts.x_label)
        .call(fontSize, 'axis_label_font_size');
    }
    if (opts.y_label) {
      svg.append('text').attr('class', 'axis-label y')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 15)
        .attr('text-anchor', 'middle')
        .text(opts.y_label)
        .call(fontSize, 'axis_label_font_size');
    }

    // Annotation table: Cohort (N) | median (CI) | P-value. The median and P-value columns are
    // optional (show_median / show_p_value; no p_value = no column). Every cell is measured as
    // rendered, so any font and annotation_font_size line up. Falls back to a simple legend when
    // no medians are supplied.
    var hasTableData = opts.medians && opts.medians.length;

    if (hasTableData) {
      var annSize = opts.annotation_font_size || 12;
      var lLen = 14, lPad = 5, rowH = Math.max(16, Math.round(annSize * 1.35)), colGap = 12;

      var epLabel = opts.endpoint
        ? opts.endpoint + (opts.time_unit ? ' (' + opts.time_unit + ')' : '')
        : 'Median';

      var col1Strs = nest.map(function(s) {
        var isReal = s.key !== 'series';
        var sm = opts.medians.filter(function(m) { return m.strata === s.key; })[0];
        return (isReal ? dispLabel(s.key) : 'Overall') +
               (sm && sm.n != null ? ' (N=' + sm.n + ')' : '');
      });
      var col2Strs = nest.map(function(s) {
        var sm = opts.medians.filter(function(m) { return m.strata === s.key; })[0];
        return sm ? sm.label : '—';
      });

      function textW(strs, cls) {
        var w = 0;
        strs.forEach(function(str) {
          var t = svg.append('text').attr('class', cls).call(fontSize, 'annotation_font_size').text(str);
          w = Math.max(w, t.node().getComputedTextLength());
          t.remove();
        });
        return w;
      }

      var cols = [{ x: 0, head: 'Cohort', cells: col1Strs, swatch: true,
                    w: lLen + lPad + Math.max(textW(['Cohort'], 'ann-header'), textW(col1Strs, 'annotation')) }];
      if (showMedian) cols.push({ head: epLabel, cells: col2Strs,
                    w: Math.max(textW([epLabel], 'ann-header'), textW(col2Strs, 'annotation')) });
      if (showP) cols.push({ head: 'P-value', cells: [opts.p_value],
                    w: Math.max(textW(['P-value'], 'ann-header'), textW([opts.p_value], 'annotation')) });
      for (var ci = 1; ci < cols.length; ci++) cols[ci].x = cols[ci - 1].x + cols[ci - 1].w + colGap;
      var tableW = cols[cols.length - 1].x + cols[cols.length - 1].w;

      var tblG = svg.append('g')
        .attr('transform', 'translate(' + (width - 5 - tableW) + ', 10)');

      cols.forEach(function(c) {
        tblG.append('text').attr('x', c.x + (c.swatch ? lLen + lPad : 0)).attr('y', 4)
          .attr('text-anchor', 'start').attr('class', 'ann-header')
          .call(fontSize, 'annotation_font_size').text(c.head);
      });

      nest.forEach(function(s, si) {
        var clr  = color(s.key);
        var rowY = (si + 1) * rowH;
        tblG.append('line')
          .attr('x1', 0).attr('x2', lLen)
          .attr('y1', rowY).attr('y2', rowY)
          .style('stroke', clr).style('stroke-width', 2);
        cols.forEach(function(c, k) {
          if (si >= c.cells.length) return;   // the p-value has one cell, on the first row
          var t = tblG.append('text')
            .attr('x', c.x + (c.swatch ? lLen + lPad : 0)).attr('y', rowY + 4)
            .attr('text-anchor', 'start').attr('class', 'annotation')
            .call(fontSize, 'annotation_font_size').text(c.cells[si]);
          if (k === 0) t.style('fill', clr);
        });
      });

    } else if (nest.length > 1 || nest[0].key !== 'series') {
      // Simple legend fallback for direct rd3survival() calls
      var legG = svg.append('g').attr('transform', 'translate(' + (width - 5) + ', 10)');
      var lLen2 = 18, lPad2 = 8, legRowH = 22;
      nest.forEach(function(s, i) {
        var clr = color(s.key);
        legG.append('line')
          .attr('x1', -(lLen2 + lPad2)).attr('x2', -lPad2)
          .attr('y1', i * legRowH).attr('y2', i * legRowH)
          .style('stroke', clr).style('stroke-width', 2.5);
        legG.append('text')
          .attr('x', -(lLen2 + lPad2 * 2)).attr('y', i * legRowH + 4)
          .attr('text-anchor', 'end').attr('class', 'legend-label')
          .call(fontSize, 'annotation_font_size')
          .text(s.key);
      });
    }

    // Median crosshair reference lines (clipped to plot area)
    if (showMedianLines && opts.medians && opts.medians.length) {
      var refGroup = svg.append('g').attr('clip-path', 'url(#limit-clip)');

      refGroup.append('line')
        .classed('median-ref horiz', true)
        .attr('x1', 0).attr('x2', width)
        .attr('y1', y(0.5)).attr('y2', y(0.5))
        .style('stroke', fg);

      opts.medians.forEach(function(m) {
        if (m.val == null) return;
        refGroup.append('line')
          .classed('median-ref vert', true)
          .datum(m.val)
          .attr('x1', x(m.val)).attr('x2', x(m.val))
          .attr('y1', 0).attr('y2', height)
          .style('stroke', color(m.strata));
      });
    }

    // ---- Tooltip ----
    context.style('position', 'relative');
    var tooltip = context.append('div').attr('class', 'surv-tooltip').style('display', 'none');

    // Vertical crosshair (clipped, sits above data paths)
    var crosshair = svg.append('g')
      .attr('clip-path', 'url(#limit-clip)')
      .append('line')
      .attr('class', 'tt-crosshair')
      .attr('y1', 0).attr('y2', height)
      .style('stroke', fg)
      .style('display', 'none');

    var bisect = d3.bisector(function(d) { return d.time; }).left;
    function rowAtTime(values, tVal) {
      var i = Math.max(0, bisect(values, tVal, 1) - 1);
      return values[Math.min(i, values.length - 1)];
    }

    svg.on('mousemove.tt', function() {
      var m = d3.mouse(this);
      if (m[0] < 0 || m[0] > width || m[1] < 0 || m[1] > height) {
        tooltip.style('display', 'none');
        crosshair.style('display', 'none');
        return;
      }
      var tVal = x.invert(m[0]);

      crosshair.attr('x1', m[0]).attr('x2', m[0]).style('display', null);

      var html = '<div class="tt-time">t = ' + d3.format('.1f')(tVal) + '</div>';
      nest.forEach(function(s) {
        var row = rowAtTime(s.values, tVal);
        var clr = color(s.key);
        html += '<div class="tt-row" style="border-left:3px solid ' + clr + '">';
        if (s.key !== 'series') {
          html += '<span class="tt-strata-name">' + s.key + '</span><br>';
        }
        html += 'Survival: ' + d3.format('.1%')(row.estimate);
        if (row['conf.low'] != null && row['conf.high'] != null) {
          html += ' (' + d3.format('.1%')(row['conf.low']) + '–' + d3.format('.1%')(row['conf.high']) + ')';
        }
        html += '<br>At risk: ' + row['n.risk'];
        html += '</div>';
      });
      tooltip.html(html).style('display', 'block');

      var cRect = context.node().getBoundingClientRect();
      var pixX  = d3.event.clientX - cRect.left;
      var pixY  = d3.event.clientY - cRect.top;
      var ttW   = tooltip.node().offsetWidth || 200;
      var leftPos = pixX + 15;
      if (leftPos + ttW + 10 > cRect.width) leftPos = pixX - ttW - 15;
      tooltip.style('left', leftPos + 'px').style('top', Math.max(0, pixY - 10) + 'px');
    })
    .on('mouseleave.tt', function() {
      tooltip.style('display', 'none');
      crosshair.style('display', 'none');
    });

    svg.append("g")
      .attr("class", "brush")
      .call(brush)
      
      
    function brushed() {
        
        function arrangeSelection(sel) {
            return [
                [d3.min([sel[0][0],sel[1][0]]),d3.max([sel[0][1],sel[1][1]])],
                [d3.max([sel[0][0],sel[1][0]]),d3.min([sel[0][1],sel[1][1]])]
            ]
        }
        
        function flatten(x) {
                  return [x[0][0],x[0][1],x[1][0],x[1][1]];
        }
        
        function zoomChart(xDomain, yDomain) {
            x.domain(xDomain).nice()
            y.domain(yDomain).nice()
            conf.attr('d', function(d) { return area(d.values)})
            estimate.attr('d', function(d) { return line(d.values)})
            svg.select('.axis.y').call(yAxis)
            svg.select('.grid.y').call(yGrid)
            svg.select('.axis.x').call(xAxis)
            svg.select('.grid.x').call(xGrid)
            svg.selectAll('.axis text').style('fill', fg)
            fontSize(svg.selectAll('.axis text'), 'axis_font_size')
            svg.selectAll('.axis path, .axis line').style('stroke', fg)
            svg.selectAll('.grid path, .grid line').style('stroke', fg)
            svg.selectAll('line.median-ref.horiz')
              .attr('y1', y(0.5)).attr('y2', y(0.5))
            svg.selectAll('line.median-ref.vert')
              .attr('x1', function(d) { return x(d); })
              .attr('x2', function(d) { return x(d); })
            svg.selectAll('text.risk-value')
              .attr('x', function(d) { return x(d); })
        }

        if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return;

        var s = arrangeSelection(d3.event.selection || [[0,0],[0,0]]);

        console.log(s)

        if(d3.sum(flatten(s)) > 0) {
            lastExtent = s;
            zoomChart([x.invert(s[0][0]),x.invert(s[1][0])], [y.invert(s[0][1]),y.invert(s[1][1])])
            svg.select('g.brush').call(brush.move, [[0,0],[0,0]])
        } else if(d3.sum(flatten(lastExtent))==0) {
                zoomChart(domain.x, domain.y)
        } else {
            lastExtent = [[0,0],[0,0]];
        }
    }

    // Risk table below main plot
    if (opts.risk_table && opts.risk_table.length) {
      var riskRowH = Math.max(18, Math.round((opts.risk_font_size || 11) * 1.6)), riskTopPad = 14, riskBotPad = 10;

      var riskByKey = {};
      opts.risk_table.forEach(function(d) {
        if (!riskByKey[d.strata]) riskByKey[d.strata] = [];
        riskByKey[d.strata].push(d);
      });
      var riskStrata = nest.map(function(s) {
        return { key: s.key, values: riskByKey[s.key] || [] };
      });

      var riskH = riskTopPad + (riskStrata.length + 1) * riskRowH + riskBotPad;
      svgEl.attr('viewBox', '0 0 ' + totalW + ' ' +
        (height + margin.top + margin.bottom + extraTop + riskH));

      var riskG = svg.append('g').attr('class', 'risk-table')
        .attr('transform', 'translate(0,' + (height + margin.bottom + riskTopPad) + ')');

      riskG.append('text')
        .attr('x', -5).attr('y', 0)
        .attr('text-anchor', 'end').attr('class', 'risk-title')
        .call(fontSize, 'risk_font_size')
        .text('No. at risk');

      riskStrata.forEach(function(s, i) {
        var clr = color(s.key);
        var rowY = (i + 1) * riskRowH;
        riskG.append('text')
          .attr('x', -18).attr('y', rowY)
          .attr('text-anchor', 'end').attr('class', 'risk-strata-label')
          .style('fill', clr)
          .call(fontSize, 'risk_font_size')
          .text(dispLabel(s.key));
        s.values.forEach(function(d) {
          riskG.append('text')
            .classed('risk-value', true)
            .datum(d.time)
            .attr('x', x(d.time)).attr('y', rowY)
            .attr('text-anchor', 'middle')
            .call(fontSize, 'risk_font_size')
            .text(d.n_risk);
        });
      });
    }

    // Apply foreground colour to all non-strata-coloured text, axes, and grid lines.
    // Elements with an explicit strata fill (annotation cohort names, risk strata labels)
    // already have an inline style set, so this.style.fill is non-empty — skip those.
    svgEl.selectAll('text').each(function() {
      if (!this.style.fill) d3.select(this).style('fill', fg);
    });
    svg.selectAll('.axis path, .axis line').style('stroke', fg);
    svg.selectAll('.grid path, .grid line').style('stroke', fg);

  }
  
  return f;
  
}

window.rd3survival_d3 = d3;
})(window.d3);

// Give the page back the d3 it had before isolate-pre.js (if any). With none, leave no global, so
// a d3 loaded later builds its own object instead of merging into this private v5.
window.d3 = window.__rd3survival_prev_d3;
delete window.__rd3survival_prev_d3;
