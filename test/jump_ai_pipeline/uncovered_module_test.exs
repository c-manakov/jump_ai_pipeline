defmodule JumpAiPipeline.UncoveredModuleTest do
  use ExUnit.Case
  alias JumpAiPipeline.UncoveredModule

  describe "get_current_time/0" do
    test "returns a DateTime struct with the current UTC time" do
      result = UncoveredModule.get_current_time()
      
      assert %DateTime{} = result
      assert result.time_zone == "Etc/UTC"
      
      # Verify the time is within 1 second of now
      now = DateTime.utc_now()
      diff = DateTime.diff(now, result, :second)
      assert diff >= 0
      assert diff < 1
    end
  end
end