import {
    registerDecorator,
    ValidationOptions,
    ValidationArguments,
} from "class-validator"

/**
 * Decorator kiểm tra ít nhất một trong hai trường phải có giá trị (không được để trống cả hai).
 * Dùng cho class-level validation.
 */
export function AtLeastOneName(
    property1: string,
    property2: string,
    validationOptions?: ValidationOptions,
) {
    return function (constructor: Function) {
        registerDecorator({
            name: "atLeastOneName",
            target: constructor,
            propertyName: "", // Dùng chuỗi rỗng cho class-level decorator
            options: validationOptions,
            validator: {
                validate(_: any, args: ValidationArguments) {
                    const obj = args.object as any
                    return !!(obj[property1] || obj[property2])
                },
                defaultMessage(args: ValidationArguments) {
                    return `At least one of "${property1}" or "${property2}" must be provided`
                },
            },
        })
    }
}
