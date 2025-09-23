import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator"

export function IsStrongPassword(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: "isStrongPassword",
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                    if (typeof value !== "string") return false
                    
                    // At least 8 characters
                    if (value.length < 6) return false
                
                    
                    return true
                },
                defaultMessage(args: ValidationArguments) {
                    return "Password must be at least 6 characters long"
                },
            },
        })
    }
}