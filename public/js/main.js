

// This function builds the query for the webscraper to then scrape
// $(function(){
//     var script = document.createElement('script');
//     script.src = 'https://code.jquery.com/jquery-3.4.1.min.js';
//     script.type = 'text/javascript';
//     document.getElementsByTagName('head')[0].appendChild(script);
//     $('#search').on('keyup', function(e){
//       if(e.keyCode === 13) {
//         var parameters = { search: $(this).val() };
//           $.get( '/search/*',parameters, function(data) {
//           $('#results').html(data);
//         });
//        };
//     });
//    });