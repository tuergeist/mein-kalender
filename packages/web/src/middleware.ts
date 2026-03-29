import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/calendar/:path*", "/settings/:path*", "/profile/:path*", "/admin/:path*", "/bookings/:path*", "/sync/:path*"],
};
