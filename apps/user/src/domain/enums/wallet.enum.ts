import { registerEnumType } from "@nestjs/graphql"

export enum Wallet_Type {
    ADMIN = "ADMIN",
    FUNDRAISER = "FUNDRAISER"
}

export enum Transaction_Type {
    DONATION_RECEIVED = "DONATION_RECEIVED",
    INCOMING_TRANSFER = "INCOMING_TRANSFER",
    WITHDRAWAL = "WITHDRAWAL",
    ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT"
}

registerEnumType(Wallet_Type, {
    name: "Wallet_Type",
    description: "Wallet type in the system",
})


registerEnumType(Transaction_Type, {
    name: "Transaction_Type",
    description: "Transaction type in the system",
})