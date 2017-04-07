process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const Koa = require('koa');
const app = new Koa();

//设置路由
require('./routes')(app);

app.on('error', (err) => {
    console.log('error', err);
});

app.listen(3000,  () => {
    console.log('Koa server is listening, in %s env', app.env);
});

module.exports = app;