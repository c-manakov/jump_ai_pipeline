defmodule JumpAiPipeline.Repo do
  use Ecto.Repo,
    otp_app: :jump_ai_pipeline,
    adapter: Ecto.Adapters.Postgres
end
