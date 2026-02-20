import { useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import api from "../api/axios";

export default function UserAutocomplete({ onSelect }) {
  const [options, setOptions] = useState([]);

  const fetchUsers = async (value) => {
    const response = await api.get(`/users?search=${value}`);
    setOptions(response.data);
  };

  return (
    <Autocomplete
      options={options}
      getOptionLabel={(option) => option.display_name}
      onInputChange={(e, value) => fetchUsers(value)}
      onChange={(e, value) => onSelect(value)}
      renderInput={(params) => (
        <TextField {...params} label="Select User" />
      )}
    />
  );
}
