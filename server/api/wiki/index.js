const router = require('koa-router')();
const wikiController = require('./wiki.controller');

router.post('/pageSearch', wikiController.pageSearch);

module.exports = router;