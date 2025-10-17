import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { BookOpenText } from "lucide-react";
import { Form } from "react-router";
import { useState } from "react";
import { clientGoogleSignIn, clientSignUp } from "~/utils/auth.client";
import googleImage from "../assets/google-icon.png"

interface SignUpProps {
  heading?: string;
  logo: {
    url: string;
    src: string;
    alt: string;
    title?: string;
  };
  buttonText?: string;
  googleText?: string;
  signupText?: string;
  signupUrl?: string;
}

const SignUp = ({
  heading = "Sign In",
  logo = {
    url: "https://www.shadcnblocks.com",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-wordmark.svg",
    alt: "logo",
    title: "shadcnblocks.com",
  },
  buttonText = "Signin",
  signinText = "Already have an account?",
  signinUrl = "/",
}: SignUpProps) => {

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    clientSignUp(email, password, name)
  }

  return (
    <section className="relative h-screen overflow-hidden bg-black">
      {/* Cyberpunk background grid - inverted colors from sign-in */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-pink-950/20 to-purple-950/20" />
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(255,0,110,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(185,103,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      {/* Scanlines effect */}
      <div className="scanlines absolute inset-0 pointer-events-none opacity-30" />

      <div className="relative flex h-full items-center justify-center z-10">
        <div className="flex flex-col items-center gap-8">
          {/* Cyberpunk logo with glow */}
          <a href={logo.url} className="group">
            <div className="relative">
              <BookOpenText className="h-8 w-8 text-pink-400 transition-all duration-300 group-hover:text-cyan-400 group-hover:scale-110" style={{
                filter: 'drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor)'
              }} />
              <div className="absolute inset-0 bg-pink-400 blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
            </div>
          </a>

          {/* Main auth card with cyber borders */}
          <div className="relative w-full max-w-sm">
            {/* Animated border glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded-lg opacity-30 blur-lg animate-pulse" />

            <div className="relative cyber-gradient-bg backdrop-blur-xl border border-pink-500/30 rounded-lg px-8 py-10 shadow-2xl">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-pink-400" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-purple-400" />

              <Form onSubmit={handleSubmit} className="space-y-6">
                {heading && (
                  <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent tracking-wider">
                    {heading.toUpperCase()}
                  </h1>
                )}

                <div className="space-y-4">
                  <div className="relative group">
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      type="text"
                      placeholder="NAME"
                      className="bg-black/50 border-purple-500/50 text-purple-100 placeholder:text-purple-900 focus:border-purple-400 focus:ring-purple-400/50 transition-all duration-300 font-mono text-sm"
                      required
                    />
                    <div className="absolute inset-0 border border-purple-400/0 group-focus-within:border-purple-400/30 rounded-md pointer-events-none transition-all duration-300" />
                  </div>

                  <div className="relative group">
                    <Input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      placeholder="EMAIL ADDRESS"
                      className="bg-black/50 border-cyan-500/50 text-cyan-100 placeholder:text-cyan-800 focus:border-cyan-400 focus:ring-cyan-400/50 transition-all duration-300 font-mono text-sm"
                      required
                    />
                    <div className="absolute inset-0 border border-cyan-400/0 group-focus-within:border-cyan-400/30 rounded-md pointer-events-none transition-all duration-300" />
                  </div>

                  <div className="relative group">
                    <Input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      placeholder="PASSWORD"
                      className="bg-black/50 border-pink-500/50 text-pink-100 placeholder:text-pink-900 focus:border-pink-400 focus:ring-pink-400/50 transition-all duration-300 font-mono text-sm"
                      required
                    />
                    <div className="absolute inset-0 border border-pink-400/0 group-focus-within:border-pink-400/30 rounded-md pointer-events-none transition-all duration-300" />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-bold tracking-wider transition-all duration-300 shadow-lg hover:shadow-pink-500/50 border-0 uppercase"
                >
                  {buttonText} <span className="terminal-blink ml-2">_</span>
                </Button>
              </Form>

              {/* Google OAuth with cyber styling */}
              <div className="mt-6 flex justify-center">
                <button
                  onClick={clientGoogleSignIn}
                  className="group relative p-3 bg-black/50 border border-purple-500/50 rounded-lg hover:border-purple-400 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30"
                >
                  <img src={googleImage} className="size-6 opacity-80 group-hover:opacity-100 transition-opacity" alt="Google" />
                </button>
              </div>
            </div>
          </div>

          {/* Sign in link with cyber styling */}
          <div className="flex gap-2 text-sm">
            <p className="text-pink-600">{signinText}</p>
            <a
              href={signinUrl}
              className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors relative group"
            >
              Back to Sign In
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cyan-400 group-hover:w-full transition-all duration-300" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignUp;