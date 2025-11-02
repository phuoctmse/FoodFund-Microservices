/**
 * Domain Interface: Auth Provider
 * Defines contract for authentication providers (Cognito, Auth0, etc.)
 */
export interface IAuthProvider {
	signUp(
		email: string,
		password: string,
		attributes: Record<string, string>,
	): Promise<{ userSub: string }>

	signIn(email: string, password: string): Promise<{
		accessToken: string
		refreshToken: string
		idToken: string
		expiresIn: number
	}>

	getUser(accessToken: string): Promise<{
		sub: string
		email: string
		emailVerified: boolean
		username: string
		name: string
	}>

	getUserByUsername(username: string): Promise<{
		sub: string
		email: string
		emailVerified: boolean
		username: string
		name: string
	} | null>

	signOut(accessToken: string): Promise<{ success: boolean }>

	refreshToken(
		refreshToken: string,
		userName: string,
	): Promise<{
		accessToken: string
		idToken: string
		expiresIn: number
	}>

	confirmSignUp(email: string, code: string): Promise<void>

	resendConfirmationCode(email: string): Promise<void>

	forgotPassword(email: string): Promise<void>

	confirmForgotPassword(
		email: string,
		code: string,
		newPassword: string,
	): Promise<void>

	changePassword(username: string, newPassword: string): Promise<void>

	deleteUser(email: string): Promise<void>

	adminConfirmSignUp(email: string): Promise<void>

	generateTokensForOAuthUser(
		username: string,
		password?: string,
	): Promise<{
		AccessToken: string
		RefreshToken: string
		IdToken: string
	}>
}
