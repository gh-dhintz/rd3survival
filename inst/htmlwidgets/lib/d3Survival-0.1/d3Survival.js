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

    // Axis labels
    if (opts.x_label) {
      svg.append('text').attr('class', 'axis-label x')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 8)
        .attr('text-anchor', 'middle')
        .text(opts.x_label);
    }
    if (opts.y_label) {
      svg.append('text').attr('class', 'axis-label y')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 15)
        .attr('text-anchor', 'middle')
        .text(opts.y_label);
    }

    // Annotation table: k x 3  (Cohort | Endpoint (unit) | P-value)
    // Falls back to a simple legend when km-wrapper opts are absent.
    var hasTableData = opts.medians && opts.medians.length && opts.medians[0].n != null;

    if (hasTableData && opts.show_median !== false) {
      var lLen = 14, lPad = 5, rowH = 16, colGap = -30;

      var epLabel = opts.endpoint
        ? opts.endpoint + (opts.time_unit ? ' (' + opts.time_unit + ')' : '')
        : 'Median';

      // Pre-build content strings so we can measure them
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

      // Measure a single character width (Consolas is monospace → charW * len is exact)
      var probe = svg.append('text').attr('class', 'annotation').text('X');
      var charW = probe.node().getComputedTextLength();
      probe.remove();

      function maxLen(strs) {
        return d3.max(strs, function(s) { return s.length; });
      }

      var maxC1 = maxLen(['Cohort'].concat(col1Strs)) * charW + lLen + lPad;
      var maxC2 = maxLen([epLabel].concat(col2Strs))  * charW;
      var maxC3 = maxLen(['P-value', opts.p_value || '']) * charW;

      var xC = 0;
      var xM = maxC1 + colGap;
      var xP = xM + maxC2 + colGap;
      var tableW = xP + maxC3;

      var tblG = svg.append('g')
        .attr('transform', 'translate(' + (width - 5 - tableW) + ', 10)');
      var annY = 0;

      // Pad headers to the max data-row length for their column so every cell
      // in a column is exactly the same pixel width (Consolas is monospace).
      // This means col2 starts immediately after col1 content with zero slack.
      function padEnd(s, n) {
        var r = s;
        while (r.length < n) r += ' '; // non-breaking space, same width as any char
        return r;
      }
      var hdr1 = padEnd('Cohort',  maxLen(col1Strs));
      var hdr2 = padEnd(epLabel,   maxLen(col2Strs));
      var hdr3 = padEnd('P-value', maxLen(['P-value', opts.p_value || '']));

      // Header row — left-aligned to match data rows
      tblG.append('text').attr('x', xC + lLen + lPad).attr('y', annY + 4)
        .attr('text-anchor', 'start').attr('class', 'ann-header').text(hdr1);
      tblG.append('text').attr('x', xM).attr('y', annY + 4)
        .attr('text-anchor', 'start').attr('class', 'ann-header').text(hdr2);
      tblG.append('text').attr('x', xP).attr('y', annY + 4)
        .attr('text-anchor', 'start').attr('class', 'ann-header').text(hdr3);
      annY += rowH;

      // Data rows
      nest.forEach(function(s, si) {
        var clr  = color(s.key);
        var sm   = opts.medians.filter(function(m) { return m.strata === s.key; })[0];

        tblG.append('line')
          .attr('x1', xC).attr('x2', xC + lLen)
          .attr('y1', annY).attr('y2', annY)
          .style('stroke', clr).style('stroke-width', 2);
        tblG.append('text')
          .attr('x', xC + lLen + lPad).attr('y', annY + 4)
          .attr('text-anchor', 'start').attr('class', 'annotation')
          .style('fill', clr)
          .text(col1Strs[si]);

        tblG.append('text')
          .attr('x', xM).attr('y', annY + 4)
          .attr('text-anchor', 'start').attr('class', 'annotation')
          .text(col2Strs[si]);

        if (si === 0 && opts.p_value) {
          tblG.append('text')
            .attr('x', xP).attr('y', annY + 4)
            .attr('text-anchor', 'start').attr('class', 'annotation')
            .text(opts.p_value);
        }

        annY += rowH;
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
          .text(s.key);
      });
    }

    // Median crosshair reference lines (clipped to plot area)
    if (opts.show_median && opts.medians && opts.medians.length) {
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
      var riskRowH = 18, riskTopPad = 14, riskBotPad = 10;

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
        .text('No. at risk');

      riskStrata.forEach(function(s, i) {
        var clr = color(s.key);
        var rowY = (i + 1) * riskRowH;
        riskG.append('text')
          .attr('x', -18).attr('y', rowY)
          .attr('text-anchor', 'end').attr('class', 'risk-strata-label')
          .style('fill', clr)
          .text(dispLabel(s.key));
        s.values.forEach(function(d) {
          riskG.append('text')
            .classed('risk-value', true)
            .datum(d.time)
            .attr('x', x(d.time)).attr('y', rowY)
            .attr('text-anchor', 'middle')
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