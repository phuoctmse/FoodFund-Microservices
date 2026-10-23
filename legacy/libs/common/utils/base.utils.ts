export const getHttpUrl = ({
    host = "localhost",
    port,
    path,
    useSsl = false,
}: GetHttpUrlParams) => {
    const prefix = useSsl ? "https://" : "http://"
    // Ensure path starts without a leading slash if it's provided
    const formattedPath = path?.startsWith("/") ? path.slice(1) : path

    // Building the URL
    const hostPort = port ? `${host}:${port}` : host
    const urlPath = formattedPath ? `/${formattedPath}` : ""

    return `${prefix}${hostPort}${urlPath}`
}

export interface GetHttpUrlParams {
    useSsl?: boolean
    host?: string
    port?: number
    path?: string
}
