import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-bg">
      <div className="text-center max-w-md p-8 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          Oops! This page doesn't exist in our 3D world
        </p>
        <Button asChild variant="hero" size="lg">
          <a href="/">
            <Home className="mr-2 h-4 w-4" />
            Return to Sandbox
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
