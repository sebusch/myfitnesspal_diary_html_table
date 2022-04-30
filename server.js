
var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var app     = express();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});


app.get('/extract-data', function(req,res){
  var url = 'https://www.myfitnesspal.com/reports/printable_diary/'+req.query['user']+'?from='+req.query['from']+'&to='+req.query['to'];
  request(url, function(error, response, html){
    if(!error){
      
      function read_tr(tr) {
        var result = [];
        tr.find('td').each(function(i, el) {
          result.push($(this).text().trim());
          var cols = $(this).prop('colspan');
          while (cols > 1) {
            result.push("");
            cols--;
          }
        });
        return result;
      }

      function numbers_only(array) {
        // returns full entry for i=0, and only numbers and -- for i>0
        var result = [];
        for (var i = 0; i < array.length; i++) {
          if (i === 0) {
            result.push(array[i]);
            continue;
          }
          var str = array[i];
          var regex_not_numbers = /[^0-9-]/gi;
          result.push(str.replace(regex_not_numbers, "").trim());
        }
        return result;
      }

      function get_units(array) {
        // returns "" for i=0, and everything but  numbers and -- for i>0
        var result = [];
        for (var i = 0; i < array.length; i++) {
          if (i === 0) {
            result.push("");
            continue;
          }
          var str = array[i];
          var regex_numbers = /[0-9-]/gi;
          result.push(str.replace(regex_numbers, "").trim());
        }
        return result;
      }

      function get_labels(table) {
        if (table.prop("tagName") == 'H4') {
          return ["Note"];
        }
        var labels = read_tr(table.find('tr').first());
        var units = get_units(read_tr(table.find('tbody tr:not(.title)').first()));
        var result = [];
        for (var i = 0; i < labels.length; i++) {
          if (units[i] == "") {
            result.push(labels[i]);
          } else {
            result.push(labels[i] + " (" + units[i] + ")");
          }
        }
        return result;
      }

      function create_obj(date, kind, labels, row) {
        var result = {"Date": date, "Label": kind};
        for (var i = 0; i < labels.length; i++) {
          result[labels[i]] = row[i];
        }
        return result;
      }

      function loop_tables(tables) {
        tables.each(function(i, el) {          
          var dateString = $(this).prevAll('h2#date').first().text().trim();
          var dateObj = new Date(dateString + " GMT");
          var date = dateObj.toISOString().split('T')[0];
          //var labels = get_labels($(this));

          $(this).find('tbody tr.title').each(function(i, el) {
            var kind = $(this).text().trim();
            var rows = $(this).nextUntil('tr.title, tfoot');
            rows.each(function(i, el) {
              var row = numbers_only(read_tr($(this)));
              //var row_obj = create_obj(date,kind,labels,row);
              //result.push(row_obj);
              result.push([date,kind].concat(row));
            });
          });
          if (req.query['totals'] == "true"){
            $(this).find('tfoot tr').each(function(i,el){
                var row = numbers_only(read_tr($(this)));
                result.push([date,row.shift(),""].concat(row));
            });
          }

        })
      }
      function makeTableHTML(myArray) {
          var result = "<table border=1>";
          for(var i=0; i<myArray.length; i++) {
              result += "<tr>";
              for(var j=0; j<myArray[i].length; j++){
                  result += "<td>"+myArray[i][j]+"</td>";
              }
              result += "</tr>";
          }
          result += "</table>";

          return result;
      }
      function loop_notes(notes) {
        //var result = [["Date","Label","Note"]]
        //var result = [];
        notes.each(function(i,el) {
          var date = $(this).prevAll('h2#date').first().text().trim();
          var label = $(this).text().trim();
          var content = $(this).next().html();
          result.push([date,label,content]);
        });
        //return result;
      }
      
      var $ = cheerio.load(html);
      // check that diary actually loaded:
      if ($('h1').first().text().trim() == "This Diary is Private"){
        res.send('This Diary is Private');
        return;
      }
      else if ($('h2#date').first().text().trim() == "No diary entries were found for this date range."){
        res.send('No diary entries were found for this date range.');
        return;
      }
      var food_tables = $('table#food');
      var exercise_tables = $('table#excercise');
      var notes = $('h4.notes');
      
      var num_diary_entries = food_tables.length + exercise_tables.length + notes.length;
     
            
      var result_type ='';
      if (req.query['kind'] =='food') {//food, exercise, notes
        result_type = food_tables;
      }
      else if (req.query['kind'] =='exercise') {//food, exercise, notes
        result_type = exercise_tables;
      }
      else if (req.query['kind'] =='notes') {//food, exercise, notes
        result_type = notes;
      }
      // give nice error message if selected type isn't available in date range
      if (num_diary_entries > 0) {
        if (result_type.length == 0) {
          res.send('No results of that type in date range');
          return;
        }
      }
      else {
        res.send('Sorry, there was an unknown error');
        return;
      }
      

       

      var labels = get_labels(result_type.first());
      var result = [];
      result.push(['Date','Label'].concat(labels));
      if  (req.query['kind'] =='notes') {
        loop_notes(result_type)
      }       
      else {
        loop_tables(result_type);
      }
      res.send(makeTableHTML(result));
    }
    //res.send(makeTableHTML(loop_notes(notes)));


  });
});


app.listen('8081')
console.log('Magic happens on port 8081');
exports = module.exports = app;
