import { Injectable, ExecutionContext } from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"

@Injectable()
export class CognitoAuthGuard extends AuthGuard("cognito-auth") {
    getRequest(context: ExecutionContext) {
        return context.switchToHttp().getRequest()
    }
}
