const neo4j = require('neo4j-driver').v1;
const orm = require('./../config/orm.conf');


module.exports = {
    getRelateds:async (node) => {
        const driver = neo4j.driver(orm.neo4j_path,neo4j.auth.basic('neo4j','XZdata@2311'));
        let session = driver.session();
        let res = await session.run("MATCH p=(a:"+node.type+")-[:related*..1]->(b) where a.name='"+node.name+"' return p");
        return res['records'];
    },
    allNodes: async () => {
        const driver = neo4j.driver(orm.neo4j_path, neo4j.auth.basic('neo4j', 'XZdata@2311'));
        let session = driver.session();

        let records = await session.run('MATCH (n) RETURN n');
        session.close();
        driver.close();

        records = records['records'];
        let nodes = [];
        records.forEach(function (res) {
            let name = res['_fields'][0]['properties'].name;
            let labels = res['_fields'][0]['labels'][0];
            let node = {id: name, group: labels};
            nodes.push(node);
        });

        return nodes;
    },
    allPaths: async (from, to) => {
        const driver = neo4j.driver(orm.neo4j_path, neo4j.auth.basic('neo4j', 'XZdata@2311'));
        let session = driver.session();

        let res = await session.run(
            'MATCH (a {name:{a1}})' +
            'MATCH (b {name:{b1}})' +
            'MATCH p=(a)-[:RELATED*..5]-(b)' +
            'RETURN p', {a1: from, b1: to});

        session.close();
        driver.close();

        res = res['records'];

        let links = [];
        let paths = [];
        res.forEach(function (record) {
            let _path = [];

            let flag = true;

            let path = record['_fields'];
            let segments = path[0]['segments'];
            for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
                let start = segments[i].start.properties.name;
                let end = segments[j].end.properties.name;
                if (start == end) {
                    flag = false;
                    break;
                }
            }


            if (flag) {
                segments.forEach(function (node) {
                    links.push({source: node.start.properties.name, value: 10, target: node.end.properties.name});
                    _path.push({source: node.start.properties.name, value: 10, target: node.end.properties.name});
                });
            }
            if (_path.length > 0) paths.push(_path);

        });

        return {links: links, paths: paths};
    },
    fuzzyQuery: async (word) => {
        const driver = neo4j.driver(orm.neo4j_path, neo4j.auth.basic('neo4j', 'XZdata@2311'));
        let session = driver.session();

        let records = await session.run("MATCH (n) WHERE n.name=~{n1} RETURN n", {n1: word + '.*'});
        records = records['records'];

        let nodes = [];

        records.forEach(function (record) {
            let _fields = record['_fields'];
            let Node = _fields[0];
            let name = Node.properties.name;
            nodes.push(name);
        });

        session.close();
        driver.close();


        return nodes;
    }
};