defmodule JumpAiPipeline.UncoveredModuleTest do
  use ExUnit.Case, async: true
  alias JumpAiPipeline.UncoveredModule

  describe "get_current_time/0" do
    test "returns a DateTime struct with current UTC time" do
      result = UncoveredModule.get_current_time()
      
      # Check that we get a DateTime struct
      assert %DateTime{} = result
      
      # Check that it's in UTC
      assert result.time_zone == "Etc/UTC"
      
      # Check that it's close to now
      now = DateTime.utc_now()
      diff = DateTime.diff(now, result, :second)
      assert diff >= 0 and diff < 2
    end
  end
end