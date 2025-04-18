const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const EventEmitter = require('events');

const port = 3000;

const log = new EventEmitter();
const todosPath = path.join(__dirname, 'todos.json');

log.on('log', (message) => {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFile('log.txt', logMessage, (err) => {
    if (err) console.error('Error writing to log:', err);
  });
});

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const pathname = parsedUrl.pathname;

  res.setHeader('Content-Type', 'application/json');

  // 🔹 Log every request
  log.emit('log', `${method} ${pathname}`);

  if (pathname === '/todos' && method === 'GET') {
    // Handle GET request to fetch all todos
    fs.readFile(todosPath, 'utf-8', (err, data) => {
      if (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ message: 'Error reading todos' }));
      }
      res.statusCode = 200;
      res.end(data);
    });
  } else if (pathname === '/todos' && method === 'POST') {
    // Handle POST request to create a new todo
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const newTodo = JSON.parse(body);

        // Check if title is provided
        if (!newTodo.title) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ message: 'Title is required' }));
        }

        // Set default completed if not provided
        if (typeof newTodo.completed === 'undefined') newTodo.completed = false;

        // Validate completed field (must be a boolean)
        if (typeof newTodo.completed !== 'boolean') {
          res.statusCode = 400;
          return res.end(JSON.stringify({ message: 'Completed must be a boolean' }));
        }

        // Read existing todos and append the new one
        fs.readFile(todosPath, 'utf-8', (err, data) => {
          if (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ message: 'Error reading todos' }));
          }

          const todos = JSON.parse(data);
          newTodo.id = todos.length ? todos[todos.length - 1].id + 1 : 1;
          todos.push(newTodo);

          fs.writeFile(todosPath, JSON.stringify(todos, null, 2), (err) => {
            if (err) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ message: 'Error saving todo' }));
            }

            res.statusCode = 201;
            res.end(JSON.stringify(newTodo));
          });
        });
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'Invalid JSON format' }));
      }
    });
  } else if (pathname.startsWith('/todos/') && method === 'DELETE') {
    // DELETE: Remove a todo by ID
    const id = parseInt(pathname.split('/')[2]);

    fs.readFile(todosPath, 'utf-8', (err, data) => {
      if (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ message: 'Error reading todos' }));
      }

      let todos = JSON.parse(data);
      const index = todos.findIndex(todo => todo.id === id);

      if (index === -1) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ message: 'Todo not found' }));
      }

      const deleted = todos.splice(index, 1);

      fs.writeFile(todosPath, JSON.stringify(todos, null, 2), (err) => {
        if (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ message: 'Error deleting todo' }));
        }

        res.statusCode = 200;
        res.end(JSON.stringify({ message: 'Todo deleted', todo: deleted[0] }));
      });
    });
  } else if (pathname.startsWith('/todos/') && method === 'PUT') {
    // PUT: Update a todo by ID
    const id = parseInt(pathname.split('/')[2]);
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const updatedTodo = JSON.parse(body);

        // Check if title is provided
        if (!updatedTodo.title) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ message: 'Title is required' }));
        }

        // Validate completed field (must be a boolean)
        if (typeof updatedTodo.completed !== 'undefined' && typeof updatedTodo.completed !== 'boolean') {
          res.statusCode = 400;
          return res.end(JSON.stringify({ message: 'Completed must be a boolean' }));
        }

        fs.readFile(todosPath, 'utf-8', (err, data) => {
          if (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ message: 'Error reading todos' }));
          }

          let todos = JSON.parse(data);
          const index = todos.findIndex(todo => todo.id === id);

          if (index === -1) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ message: 'Todo not found' }));
          }

          todos[index] = { ...todos[index], ...updatedTodo, id };

          fs.writeFile(todosPath, JSON.stringify(todos, null, 2), (err) => {
            if (err) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ message: 'Error updating todo' }));
            }

            res.statusCode = 200;
            res.end(JSON.stringify(todos[index]));
          });
        });
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'Invalid JSON format' }));
      }
    });
  } else if (pathname.startsWith('/todos/') && method === 'GET') {
    // GET by ID: Return a single todo
    const id = parseInt(pathname.split('/')[2]);

    fs.readFile(todosPath, 'utf-8', (err, data) => {
      if (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ message: 'Error reading todos' }));
      }

      const todos = JSON.parse(data);
      const todo = todos.find(todo => todo.id === id);

      if (!todo) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ message: 'Todo not found' }));
      }

      res.statusCode = 200;
      res.end(JSON.stringify(todo));
    });
  } else {
    // Handle 404 for all other routes
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Route not found' }));
  }
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
