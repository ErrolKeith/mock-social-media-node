const bcrypt = require("bcryptjs")
const validator = require('validator')
const userCollection = require('../db').db().collection("users")
const md5 = require('md5')

let User = function(data, getAvatar) {
    this.data = data
    this.errors = []
    if (getAvatar == undefined) { getAvatar = false }
    if (getAvatar) {this.getAvatar()}
}

User.prototype.cleanUp = function(){
    if (typeof(this.data.username) != "string") {this.data.username = ""}
    if (typeof(this.data.email) != "string") {this.data.email = ""}
    if (typeof(this.data.password) != "string") {this.data.password = ""}

    // get rid of any bogus properties
    this.data = {
        username: this.data.username.trim().toLowerCase(),
        email: this.data.email.trim().toLowerCase(),
        password: this.data.password
    }
}

User.prototype.validate =  function(){
    return new Promise(async (resolve, reject) => {
        if (this.data.username == "") {this.errors.push("You must provide a username.")}
        if (this.data.username != "" && !validator.isAlphanumeric(this.data.username)) {this.errors.push("Username can only contain letters and numbers.")}
        if (!validator.isEmail(this.data.email)) {this.errors.push("You must provide a valid email address.")}
        if (this.data.password == "") {this.errors.push("You must provide a valid password.")}
        if (this.data.password.length < 12 && this.data.password.length > 0) {this.errors.push("Passwords must have 12 or more characters.")}
        if (this.data.password.length > 50) {this.errors.push("Password cannot exceed 50 characters.")}
        if (this.data.username.length < 3 && this.data.username.length > 0) {this.errors.push("Username must have 3 or more characters.")}
        if (this.data.username.length > 30) {this.errors.push("Username cannot exceed 30 characters.")}
    
        //only if username is valid check to see if it is already taken
        if(this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)){
            let usernameExists = await userCollection.findOne({username: this.data.username})
            if(usernameExists){this.errors.push("Username is already taken.")}
        }
    
        //only if email is valid check to see if it is already taken
        if(validator.isEmail(this.data.email)){
            let emailExists = await userCollection.findOne({email: this.data.email})
            if(emailExists){this.errors.push("email is already in use.")}
        }

        resolve()
    })
}

User.prototype.login = function() {

    return new Promise((resolve, reject) => {
        this.cleanUp()
        userCollection.findOne({username: this.data.username}).then((attemptedUser) => {
            if(attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
                this.data = attemptedUser
                this.getAvatar()
                resolve("Congrats")
            } else {
                reject("Invalid username/password")
            }
        }).catch(function() {
            reject("Please try again later.")
        })
    })
    /*Old callback function solution 
    this.cleanUp()
    userCollection.findOne({username: this.data.username}, (err, attemptedUser) => {
        if(attemptedUser && attemptedUser.password == this.data.password) {
            callback("Congrats")
        } else {
            callback("Invalid")
        }
    })*/
}

User.prototype.register = function(){
    return new Promise(async (resolve, reject) => {
        //Step # 1 validate user data
        this.cleanUp()
        await this.validate()
    
        //Step # 2 only if there are no validation errors
        //then save the user data into a database.
        if (!this.errors.length) {
            //hash user password
            let salt = bcrypt.genSaltSync(10)
            this.data.password = bcrypt.hashSync(this.data.password, salt)
            //submit user data with hashed password.
            userCollection.insertOne(this.data)
            this.getAvatar()
            await resolve()
        } else {
            reject(this.errors)
        }
        
    })
}

User.prototype.getAvatar = function(){
    this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`
}

User.findByUsername = function(username) {
    return new Promise(function(resolve, reject) {
        if(typeof(username) != 'string') { 
            reject() 
            return
        }
        userCollection.findOne({username: username}).then(function(userDoc) {
            if(userDoc) {
                userDoc = new User(userDoc, true)
                userDoc = {
                    _id: userDoc.data._id,
                    username: userDoc.data.username,
                    avatar: userDoc.avatar
                }
                resolve(userDoc)
            } else {
                reject()
            }
        }).catch(function() {
            reject()
        })
    })
}

User.doesEmailExist = function(email) {
    return new Promise(async function(resolve, reject) {
        if (typeof(email) != "string") {
            resolve(false)
            return
        }

        let user = await userCollection.findOne({email: email})
        if(user) {
            resolve(true)
        } else {
            resolve(false)
        }
    })
}

module.exports = User