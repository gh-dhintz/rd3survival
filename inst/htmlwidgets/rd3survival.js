HTMLWidgets.widget({

  name: 'rd3survival',

  type: 'output',

  factory: function(el, width, height) {

    // TODO: define shared variables for this instance

    return {

      renderValue: function(x) {

        // TODO: code to render the widget, e.g.
        //el.innerText = x.message;
        // the package's private d3 v5 (see d3Survival.js), never the page's global d3
        var d3 = window.rd3survival_d3;
        var surv = d3.survival(x)
        
        d3.select(el).call(surv);
        
      },

      resize: function(width, height) {

        // TODO: code to re-render the widget with a new size

      }

    };
  }
});