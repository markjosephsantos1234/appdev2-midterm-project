const http = require('http');
const fs = require('fs');
const url = require('url');
const { EventEmitter } = require('events');

const PORT = 3000;
const DATA_FILE = 'todos.json';
const LOG_FILE = 'logs.txt';

// Logger setup
const logger = new EventEmitter();
logger.on('log', (msg) => {
  const time = new Date().toISOString();
  fs.appendFile(LOG_FILE, `${time} - ${msg}\n`, (err) => {
    if (err) console.error('Logging error:', err);
  });
});

// Utility functions
const readTodos = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const writeTodos = (todos) => fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2));

// Send JSON
const send = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

// Server logic
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const method = req.method;
  const id = parseInt(path.split('/')[2]);

  logger.emit('log', `${method} ${path}`);

  if (path === '/todos' && method === 'GET') {
    const todos = readTodos();   //Read all todos from todos.json file
    const filtered = parsed.query.completed 
    ? todos.filter(t => t.completed === (parsed.query.completed === 'true')) //If ?completed=true/false is provided, filter the list
    : todos; //Otherwise, return all todos
    return send(res, 200, filtered); //Send the result back to the client
  }

  if (path.match(/^\/todos\/\d+$/) && method === 'GET') {
    const todos = readTodos(); //Read all todos
    const todo = todos.find(t => t.id === id); //Find the one with matching ID
    return todo ? send(res, 200, todo) : send(res, 404, { error: 'Todo not found' }); //return error if not found
  }

  if (path === '/todos' && method === 'POST') {
    let body = ''; //Empty string to store incoming data
    req.on('data', chunk => body += chunk); //Append chunks of data as they arrive
    req.on('end', () => { //Once all data is received
      try {
        const data = JSON.parse(body);
        if (!data.title) return send(res, 400, { error: 'Title is required' });
        const todos = readTodos();
        const newTodo = {   
          id: todos.length ? todos[todos.length - 1].id + 1 : 1,
          title: data.title,
          completed: data.completed ?? false
        };
        todos.push(newTodo);
        writeTodos(todos);
        send(res, 200, newTodo);
      } catch {
        send(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (path.match(/^\/todos\/\d+$/) && method === 'PUT') {
    let body = ''; //Empty string to store incoming data
    req.on('data', chunk => body += chunk); //Receive data
    req.on('end', () => {
      try {
        const data = JSON.parse(body); //Convert to JS object
        const todos = readTodos(); //Read all todos
        const index = todos.findIndex(t => t.id === id);
        if (index === -1) return send(res, 404, { error: 'Todo not found' });
        todos[index] = { ...todos[index], ...data };
        writeTodos(todos);
        send(res, 200, todos[index]);
      } catch {
        send(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (path.match(/^\/todos\/\d+$/) && method === 'DELETE') {
    const todos = readTodos(); //Read all todos
    const index = todos.findIndex(t => t.id === id); //Find the one to delete
    if (index === -1) return send(res, 404, { error: 'Todo not found' }); //Error if not found
    const deleted = todos.splice(index, 1); //Remove the todo from the list
    writeTodos(todos); //Save the updated list
    return send(res, 200, { message: 'Todo deleted', todo: deleted[0] }); //Respond with success
  }

  send(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
