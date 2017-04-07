const bodyParser = require('koa-bodyparser')(); //处理post请求的body解析
const Router = require('koa-router')(); //koa路由控制
const cors = require('kcors')(); //koa跨域访问问题，nginx应该可以解决

const users = require('./api/users');
const info = require('./api/info');
const graph = require('./api/graph');
const wiki = require('./api/wiki');
const topic = require('./api/topic');

module.exports = function (app) {
    Router.use('/users', users.routes(), users.allowedMethods());
    Router.use('/info', info.routes(), info.allowedMethods());
    Router.use('/graph', graph.routes(), graph.allowedMethods());
    Router.use('/wiki', wiki.routes(), wiki.allowedMethods());
    Router.use('/topic',topic.routes(),topic.allowedMethods());

    app.use(bodyParser);
    app.use(cors);
    app.use(Router.routes());
}