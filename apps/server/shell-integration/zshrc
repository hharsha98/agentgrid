# Minimal zshrc for agentgrid command-block markers (OSC 133).
# Loaded when ZDOTDIR points at this folder.

[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc"

__agentgrid_precmd() {
  local code=$?
  printf '\033]133;D;%s\007' "$code"
  printf '\033]133;A\007'
}

__agentgrid_preexec() {
  printf '\033]133;C\007'
}

autoload -Uz add-zsh-hook 2>/dev/null || true
if typeset -f add-zsh-hook >/dev/null; then
  add-zsh-hook precmd __agentgrid_precmd
  add-zsh-hook preexec __agentgrid_preexec
else
  precmd_functions+=(__agentgrid_precmd)
  preexec_functions+=(__agentgrid_preexec)
fi

printf '\033]133;A\007'
