defmodule JumpAiPipelineTest do
  use ExUnit.Case
  doctest JumpAiPipeline

  describe "open_decoded_file/4" do
    test "successfully decodes a valid file" do
      # Create a temporary file with base64 encoded content
      encoded_content = Base.encode64("test content")
      tmp_path = System.tmp_dir!() |> Path.join("test_file.txt")
      File.write!(tmp_path, encoded_content)

      # Test the function
      assert {:ok, "test content"} = JumpAiPipeline.open_decoded_file(tmp_path, nil, nil, nil)

      # Clean up
      File.rm!(tmp_path)
    end

    test "returns error for non-existent file" do
      assert {:error, :badfile} =
               JumpAiPipeline.open_decoded_file("non_existent_file.txt", nil, nil, nil)
    end

    test "returns error for invalid base64 encoding" do
      # Create a temporary file with invalid base64 content
      tmp_path = System.tmp_dir!() |> Path.join("invalid_base64.txt")
      File.write!(tmp_path, "not-valid-base64!")

      # Test the function
      assert {:error, :badencoding} = JumpAiPipeline.open_decoded_file(tmp_path, nil, nil, nil)

      # Clean up
      File.rm!(tmp_path)
    end
  end

  describe "some_new_interesting_function/0" do
    test "returns the expected output" do
      assert capture_io(fn -> JumpAiPipeline.some_new_interesting_function() end) =~ "hehe"
    end
  end

  # Helper function to capture IO output
  defp capture_io(fun) do
    ExUnit.CaptureIO.capture_io(fun)
  end
end
