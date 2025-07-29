import { ClientHttp2Session, connect } from 'node:http2';

export type GrabResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    headers: {
        get: (name: string) => string | string[] | undefined | null;
    };
    json: <T>() => Promise<T>;
    text: () => Promise<string>;
};
export type Grab = {
    grab: (url: string, options?: RequestInit | any | undefined) => Promise<GrabResponse>;
    close: () => void;
};

type Options = {
    useHttp2?: boolean;
};
export const createGrabber = (options?: Options): Grab => {
    const clients = new Map();
    const IDLE_TIMEOUT = 300000; // 5 min idle timeout
    const grab = async (url: string, grabOptions?: RequestInit | any): Promise<GrabResponse> => {
        if (options?.useHttp2 !== true) {
            return fetch(url, grabOptions);
        }
        const closeAndDeleteClient = (origin: string) => {
            const clientObj = clients.get(origin);
            if (clientObj) {
                clientObj.client.close();
                clients.delete(origin);
            }
        };

        const resetIdleTimeout = (origin: string) => {
            const clientObj = clients.get(origin);
            if (clientObj && clientObj.idleTimeout) {
                clearTimeout(clientObj.idleTimeout);
            }
            clientObj.idleTimeout = setTimeout(() => {
                closeAndDeleteClient(origin);
            }, IDLE_TIMEOUT);
        };

        const getClient = (origin: string): ClientHttp2Session => {
            if (!clients.has(origin) || clients.get(origin).client.closed) {
                closeAndDeleteClient(origin);
                const client = connect(origin);
                client.on('error', () => {
                    closeAndDeleteClient(origin);
                });
                clients.set(origin, { client, idleTimeout: null });
                resetIdleTimeout(origin);
            }
            return clients.get(origin).client;
        };

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const origin = urlObj.origin;
            const client = getClient(origin);
            resetIdleTimeout(origin);
            const headers = {
                ':method': grabOptions.method || 'GET',
                ':path': urlObj.pathname + urlObj.search,
                ...grabOptions.headers,
            };
            const req = client.request(headers);
            if (grabOptions.body) {
                req.write(grabOptions.body);
            }
            req.setEncoding('utf8');
            let responseData = '';

            req.on('response', (headers) => {
                const responseHeaders: Record<string, string | string[] | undefined> = {};
                for (const name in headers) {
                    responseHeaders[name.toLowerCase()] = headers[name];
                }
                const status = headers[':status'] || 500; // Default to 500 if undefined
                const statusText = statusTexts[status as keyof typeof statusTexts] || '';
                const response = {
                    status,
                    statusText,
                    ok: status >= 200 && status < 300,
                    headers: {
                        get: (name: string) => responseHeaders[name.toLowerCase()],
                    },
                    text: () => Promise.resolve(responseData),
                    json: () => Promise.resolve(JSON.parse(responseData)),
                };

                req.on('data', (chunk) => {
                    responseData += chunk;
                });

                req.on('end', () => {
                    resetIdleTimeout(origin);
                    resolve(response);
                });

                req.on('error', (err) => {
                    resetIdleTimeout(origin);
                    reject(err);
                });
            });
            req.end();
        });
    };

    return {
        grab,
        close: () => {
            clients.forEach((clientObj) => {
                if (clientObj.idleTimeout) {
                    clearTimeout(clientObj.idleTimeout);
                }
                clientObj.client.close();
            });
            clients.clear();
        },
    };
};

const statusTexts = {
    100: 'Continue',
    101: 'Switching Protocols',
    102: 'Processing',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    207: 'Multi-Status',
    208: 'Already Reported',
    226: 'IM Used',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    418: "I'm a teapot",
    421: 'Misdirected Request',
    422: 'Unprocessable Entity',
    423: 'Locked',
    424: 'Failed Dependency',
    425: 'Too Early',
    426: 'Upgrade Required',
    428: 'Precondition Required',
    429: 'Too Many Requests',
    431: 'Request Header Fields Too Large',
    451: 'Unavailable For Legal Reasons',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates',
    507: 'Insufficient Storage',
    508: 'Loop Detected',
    510: 'Not Extended',
    511: 'Network Authentication Required',
} as const;
