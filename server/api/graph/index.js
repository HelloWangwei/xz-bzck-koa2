const router = require('koa-router')();
const controller = require('./graph.controller');

router.get('/nodes', controller.nodes);
router.get('/words/:words', controller.fuzzy);
router.get('/start/:start/end/:end', controller.paths);

module.exports = router;