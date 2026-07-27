var http=require('http');
var options={
  hostname:'mhur-planner.duckdns.org',
  path:'/api/builds',
  method:'POST',
  headers:{'Content-Type':'application/json'}
};
var req=http.request(options,function(res){
  var body='';
  res.on('data',function(c){body+=c;});
  res.on('end',function(){
    var resp=JSON.parse(body);
    console.log('Saved:',resp.id);
    var options2={
      hostname:'mhur-planner.duckdns.org',
      path:'/api/builds/'+resp.id,
      method:'GET'
    };
    http.request(options2,function(res2){
      var body2='';
      res2.on('data',function(c){body2+=c;});
      res2.on('end',function(){
        console.log('GET status:',res2.statusCode);
        console.log('GET body:',body2);
      });
    }).end();
  });
});
req.write(JSON.stringify({build:{v:4,charId:'test',cosIdx:0,styleIdx:0,left:[],right:[],specs:[]}}));
req.end();
