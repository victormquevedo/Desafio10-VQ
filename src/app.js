import { config } from './config/config.js'

import express from 'express'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import handlebars from 'express-handlebars'
import session from 'express-session'
import passport from 'passport'
import MongoStore from 'connect-mongo'

import __dirname from './utils.js'
import { initializePassport, initGithub } from './config/passport-config.js'




import productModel from './dao/persistence/mongodb/models/products-model.js'
import chatModel from './dao/persistence/mongodb/models/chat-model.js'
import productsRouterMongo from './routes/products-router-mongodb.js'
import cartsRouterMongo from './routes/carts-router-mongodb.js'
import viewsRouterMongo from './routes/views-router-mongodb.js'
import chatRouterMongo from './routes/chat-router-mongodb.js'
import sessionRouter from './routes/sessions-router.js'



const app = express()
const conection = mongoose.connect(config.mongo.url);

const httpServer = app.listen(config.server.port, () => {
    console.log(`
        The server is online on port: ${ config.server.port }
    `)
})

app.engine('handlebars', handlebars.engine())
app.set('views', __dirname + '/views')
app.set('view engine', 'handlebars')

app.use(express.static(__dirname + '/public'))
app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.use(session({
    store: new MongoStore({
        mongoUrl: config.mongo.url,
        ttl: 3600
    }),
    secret: config.secretWord.pass,
    resave: false,
    saveUninitialized: false
}))

initializePassport()
initGithub()
app.use(passport.initialize())
app.use(passport.session())

/*-----//_ Routes for MongoDB _//-----*/
app.use('/', viewsRouterMongo);
app.use('/api/products', productsRouterMongo);
app.use('/api/carts', cartsRouterMongo);
app.use('/api/session', sessionRouter);
app.use('/chat', chatRouterMongo);

const io = new Server(httpServer)

let products = await productModel.find().lean()
let mongoDbMessages = await chatModel.find().lean()

io.on('connection', socket => {
    console.log('A user has been connected to the server');

    io.emit('productsList', products)

    socket.on('productToDelete', async productId => {
        try {
            await productModel.deleteOne({_id: productId})
            let products = await productModel.find().lean()
            io.emit('productsList', products)
        } catch (error) {
            console.log(error)
        }
    })
    socket.on('productToAdd', async product => {
        try {
            await productModel.create(product)
            let products = await productModel.find().lean()
            io.emit('productsList', products)
        } catch (error) {
            console.log(error)
        }
    })

    io.emit('updateMessages', mongoDbMessages)

    socket.on('authenticated', async userEmail => {
        io.emit('newUserConnected', userEmail)
    })

    socket.on('userMessage', async message => {
        try {
            await chatModel.create(message)
            let chatHistorial = await chatModel.find().lean()
            io.emit('updateMessages', chatHistorial)
        } catch (error) {
            console.log(error)
        }
    })
})