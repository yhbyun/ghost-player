import youtubeIcon from '../renderer/src/assets/services/youtube.svg'
import netflixIcon from '../renderer/src/assets/services/netflix.png'

export interface Service {
  name: string
  icon: string
  url: string
  color: string
}

export const services: Service[] = [
  {
    name: 'Netflix',
    icon: netflixIcon,
    url: 'https://netflix.com/browse',
    color: '#e50914'
  },
  {
    name: 'YouTube',
    icon: youtubeIcon,
    url: 'https://youtube.com',
    color: '#ff0000'
  }
]
