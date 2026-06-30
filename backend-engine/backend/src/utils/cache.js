import NodeCache from "node-cache";

const userCache = new NodeCache({
    stdTTL: 1000,
    checkperiod: 200
})

export default userCache