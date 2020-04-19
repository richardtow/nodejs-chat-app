const path = require('path')                                    // Node's path module 
const http = require('http')                                    // Node's http module
const express = require('express')                              // Express app
const socketio = require('socket.io')                           // socket.io library
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()                                           // run express to create app
const server = http.createServer(app)                           // Express server does this behind the scene anyway, need to get a hold of the server next line
const io = socketio(server)                                     // socketio requires to pass in a http server, that is why we need access to a server

const port = process.env.PORT || 3000                           // define the port
const publicDirectoryPath =path.join(__dirname,'../public')     // manipulate path, _dirname is dir path for the current script, 
                                                                // the second parameter move out src and into public dir

app.use(express.static(publicDirectoryPath))                    // then the path is provided to express.static

io.on('connection', (socket) => {                               // io on 'connection' event then sent message to clients, socket is a object contains info of the connection
    console.log('New WebSocket connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser( { id: socket.id, ...options })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', 'Welcome!'))                          // send to a particular one, the one sent the 'connection' event
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))   // send to every one in the room except that particular one
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {                   // in the event, the client send a message and a callback
        const user = getUser(socket.id)
        //console.log(user.id, user.username, user.room)

        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')                // run the callback with an error message, client will receive the error
        }

        io.to(user.room).emit('message', generateMessage(user.username, message))      // send to every one in the room
        callback()                                                      // run the callback with no message
    })

    // The Google map format: "https://google.com/maps?q=latitude, longitude"
    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)

        //console.log('server got the location ' + coords.latitude + '   ' + coords.longitude)
        socket.broadcast.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback('Location shared!')
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

//app.listen(port, () =>{                                       // start the server with app
server.listen(port, () =>{                                      // start the server with server
    console.log(`Server is up on port ${port}.`)
})        
