const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type':'text/html'});
  res.end('<h1>Hello from Railway!</h1>');
}).listen(process.env.PORT || 8080, () => console.log('Test server running'));
