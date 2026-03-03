/**
 * Standardized response envelope so every API response has the same shape:
 *   { success: true,  data: <payload> }
 *   { success: false, message: "...", errors?: [...] }
 *
 * Consumers can always check `response.success` before reading `data`.
 */

export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendError(res, message, status = 400, errors) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}
