defmodule MisfitWeb.Router do
  use MisfitWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  # THROWAWAY dev scaffolding — remove with MisfitWeb.DevHarnessController.
  scope "/api", MisfitWeb do
    pipe_through :api

    post "/rooms", DevHarnessController, :create
    get "/rooms/:code", DevHarnessController, :show
    post "/rooms/:code/join", DevHarnessController, :join
    post "/rooms/:code/leave", DevHarnessController, :leave
    post "/rooms/:code/start", DevHarnessController, :start
    post "/rooms/:code/answer", DevHarnessController, :answer
    post "/rooms/:code/chat", DevHarnessController, :chat
    post "/rooms/:code/vote", DevHarnessController, :vote
    post "/rooms/:code/advance", DevHarnessController, :advance
    post "/rooms/:code/next_round", DevHarnessController, :next_round
  end

  # Enable LiveDashboard in development
  if Application.compile_env(:misfit, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: MisfitWeb.Telemetry
    end
  end
end
