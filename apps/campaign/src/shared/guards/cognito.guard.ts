import { ExecutionContext, Injectable } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import { AuthGuard } from "@nestjs/passport"
import { map, Observable } from "rxjs"

@Injectable()
export class CognitoGraphQLGuard extends AuthGuard("cognito-auth") {
    getRequest(context: ExecutionContext) {
        const gqlContext = GqlExecutionContext.create(context).getContext()
        return gqlContext.req
    }

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const canActivateResult = super.canActivate(context)
        const handleResult = (can: boolean) => {
            if (can) {
                const gqlContext =
                    GqlExecutionContext.create(context).getContext()
                const req = gqlContext.req
                if (req.user) {
                    gqlContext.user = req.user
                }
            }
            return can
        }

        if (canActivateResult instanceof Observable) {
            return canActivateResult.pipe(map(handleResult))
        }
        if (canActivateResult instanceof Promise) {
            return canActivateResult.then(handleResult)
        }
        return handleResult(canActivateResult)
    }
}
