import xss from 'xss';

// Recursively sanitize all string values
const clean = (data) => {
    if (typeof data === 'string') {
        return xss(data.trim());
    }
    if (Array.isArray(data)) {
        return data.map(item => clean(item));
    }
    if (typeof data === 'object' && data !== null) {
        Object.keys(data).forEach(key => { data[key] = clean(data[key]); });
        return data;
    }
    return data; // numbers, booleans, null pass through unchanged
};

const sanitizer = (req, res, next) => {
    if (req.body)  req.body  = clean(req.body);
    if (req.query) req.query = clean(req.query);
    

    // FIX: req.params is a non-configurable Express object.
    // Re-assigning the reference (req.params = clean(...)) is silently ignored
    // by the router — it already captured the original values.
    // Mutate the individual keys in-place instead.
    if (req.params) {
        Object.keys(req.params).forEach(key => {
            req.params[key] = clean(req.params[key]);
        });
    }

    next();
};

export default sanitizer;