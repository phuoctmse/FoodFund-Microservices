import {
    registerDecorator,
    ValidationOptions,
    ValidationArguments,
} from "class-validator"

export function IsVietnamesePhone(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: "isVietnamesePhone",
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                    if (typeof value !== "string") return false

                    // Vietnamese phone number patterns
                    const vietnamesePhoneRegex =
                        /^\+84(3[2-9]|5[689]|7[06-9]|8[1-689]|9[0-46-9])[0-9]{7}$/

                    return vietnamesePhoneRegex.test(value.replace(/\s/g, ""))
                },
                defaultMessage(args: ValidationArguments) {
                    return "Phone number must be a valid Vietnamese phone number"
                },
            },
        })
    }
}
