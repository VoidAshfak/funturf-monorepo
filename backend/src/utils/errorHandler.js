
export const errorHandler = (err, req, res, next) => {
    
    console.error(err.stack || err);

    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json({
        success: err.success || false,
        message: err.message || "Internal Server Error",
        data: err.data
    });
};