import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"

export const CurrentUser = createParamDecorator(
    (field: string | undefined, context: ExecutionContext) => {
        const gqlContext = GqlExecutionContext.create(context)
        const request = gqlContext.getContext().req
        const user = request.user

        if (!user) {
            return null
        }

        return field ? user[field] : user
    },
)
