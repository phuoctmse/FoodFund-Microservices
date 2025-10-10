import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"

export const CurrentUser = createParamDecorator(
    (field: string | undefined, context: ExecutionContext) => {
<<<<<<< HEAD
        try {
            // Try GraphQL context first
            const gqlContext = GqlExecutionContext.create(context)
            const ctx = gqlContext.getContext()
                    
            // Check different possible locations for user
            let user = ctx.req?.user || ctx.user || null
            
            // If no user in GraphQL context, try regular HTTP context
            if (!user) {
                const request = context.switchToHttp().getRequest()
                user = request?.user || null
            }
=======
        const gqlContext = GqlExecutionContext.create(context)
        const request = gqlContext.getContext().req
        if (field === "decodedToken") {
            return request.decodedToken || null
        }
        const user = request.user
>>>>>>> c846b6fbcf395724cf6c9a0fac1c849eb2e87332

            if (!user) {
                console.warn("No user found in request context")
                return null
            }

            return field ? user[field] : user
        } catch (error) {
            console.error("Error in CurrentUser decorator:", error)
            return null
        }
    },
)
